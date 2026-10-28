/**
 * 편집기 재생기 — 편집기가 쓰는 재생 동작만(위치·길이·멈춤·속도·재생/멈춤·이벤트). 이름은 <audio> 와 같다.
 * 편집기는 소리 내는 길을 모른다:
 * - 1.0× 는 <audio> (+ audio/playback 의 출력 경로).
 * - 그 밖의 속도는 배속 재생기(audio/stretchPlayer — 앱이 직접 늘인다). 속도를 처음 바꿀 때 녹음을 디코드하고, 그동안 누른 재생은 준비되면 시작한다.
 *   디코드할 수 없으면(10 분 넘음 · 실패 · AudioWorklet 없음) <audio> 의 배속으로 — 아이폰에서는 고르지 않을 수 있다고 한 번 알린다.
 * 둘 사이를 오갈 때(재생 중 속도 변경 포함) 위치를 넘겨 이어 간다.
 */
import { attachGain, beforePlay, afterStop, releaseAudio, type Playing } from './playback.ts'
import { createStretchPlayer, type StretchPlayer } from './stretchPlayer.ts'
import { audioSupported } from './engine.ts'
import { DECODE_MAX_SEC } from '../core/recPolicy.ts'
import { notice } from '../core/notice.ts'
import { t } from '../core/i18n/index.ts'
import { isIOS } from '../platform/index.ts'

export type PlayerEventName = 'loadedmetadata' | 'durationchange' | 'canplaythrough' | 'canplay' | 'timeupdate' | 'play' | 'ended'
export interface EditorPlayer {
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  readonly readyState: number
  playbackRate: number
  play(): Promise<void>
  pause(): void
  load(): void
  /** 재생 시작 직전 — 컨텍스트 깨우기 · wake lock · 연습 타이머가 재생음을 세지 않게(playback.ts) */
  willPlay(): void
  /** 멈춘 뒤 — willPlay 의 짝 */
  stopped(): void
  addEventListener(type: PlayerEventName, fn: () => void, opts?: { once?: boolean }): void
  /** 버린다 — 노드도 끊는다(WebView 의 동시 미디어 상한) */
  release(): void
}

/** @param peak 녹음 시 원시 피크(보정 게인) · @param dur 녹음 길이(s) — 배속 재생기를 쓸 수 있는지(디코드 상한) */
export function createEditorPlayer(url: string, peak: number | undefined, dur: number): EditorPlayer {
  const el = new Audio(url); el.preservesPitch = true; el.playbackRate = 1.0; el.preload = 'auto'
  attachGain(el, peak)
  let rate = 1
  let st: StretchPlayer | null = null
  let loading: Promise<void> | null = null
  let fallback = false // 배속 재생기를 못 쓴다 → <audio> 의 배속
  let pending = false // 재생을 눌렀는데 배속 재생기가 아직 준비 중
  let released = false
  const stEvents: Record<'timeupdate' | 'play' | 'ended', Array<() => void>> = { timeupdate: [], play: [], ended: [] }

  const stretching = (): boolean => rate !== 1 && st !== null
  const engine = (): Playing & { pause(): void } => stretching() ? st! : el
  /** playback.ts 에 '재생 중' 으로 올려 둔 쪽 — 길이 바뀌면 옮긴다 */
  let marked: Playing | null = null
  function mark(p: Playing | null): void { if (marked === p) return; if (marked) afterStop(marked); if (p) beforePlay(p); marked = p }

  /** 길을 바꾼다: 위치를 넘기고, 재생 중이었으면 새 길에서 이어 재생 */
  function handover(from: Playing & { pause(): void }, to: 'el' | 'st'): void {
    const playing = !from.paused || pending, t0 = from.currentTime
    from.pause(); pending = false
    if (to === 'st') { st!.currentTime = t0; if (playing) { mark(st); st!.play() } }
    else { el.currentTime = t0; if (playing) playEl() }
  }
  function prepare(): void {
    if (loading || st || fallback) return
    if (!audioSupported() || typeof AudioWorkletNode === 'undefined' || dur > DECODE_MAX_SEC) { useFallback(dur > DECODE_MAX_SEC); return }
    loading = createStretchPlayer(url, peak, rate).then(p => {
      loading = null
      if (released) { p.release(); return }
      st = p
      p.on(e => { for (const f of stEvents[e].slice()) f() })
      if (rate !== 1) handover(el, 'st')
      else st.currentTime = el.currentTime
    }, () => { loading = null; if (!released) useFallback(false) })
  }
  /** 배속 재생기 없이 <audio> 의 배속으로. 10 분 넘는 녹음이면 아이폰에서 고르지 않을 수 있다고 한 번 알린다 */
  function useFallback(tooLong: boolean): void {
    fallback = true
    if (tooLong && isIOS()) notice(t('ed.speedFallback'), 5000)
    if (pending) playEl()
  }
  /** 기다리던 재생을 <audio> 로 */
  function playEl(): void { pending = false; mark(el); void el.play().catch(() => { mark(null) }) }

  return {
    get currentTime() { return engine().currentTime },
    set currentTime(v: number) { el.currentTime = v; if (st) st.currentTime = v },
    get duration() { return el.duration },
    get paused() { return engine().paused && !pending },
    get readyState() { return el.readyState },
    get playbackRate() { return rate },
    set playbackRate(v: number) {
      const was = stretching()
      rate = v; el.playbackRate = v; el.preservesPitch = true
      if (st) st.rate = v
      if (v !== 1 && !st && !fallback) {
        if (!el.paused) { pending = true; el.pause() } // 배속 재생기가 준비되면 이어 간다 — 그동안 <audio> 의 배속(아이폰에서 깨짐)을 내지 않는다
        prepare(); return
      }
      if (pending && !stretching()) { playEl(); return } // 기다리는 동안 1.0× 로 돌아왔다
      if (was !== stretching()) handover(was ? st! : el, was ? 'el' : 'st')
    },
    async play() {
      if (rate !== 1 && !st && !fallback) { pending = true; prepare(); return } // 준비되면 handover 가 시작한다
      if (stretching()) { st!.play(); return }
      return el.play()
    },
    pause() { pending = false; el.pause(); st?.pause() },
    load: () => el.load(),
    willPlay: () => mark(stretching() ? st : el), // 배속 재생기를 기다리는 동안은 <audio> 로 — 컨텍스트를 이 손짓 안에서 깨워야 한다(아이폰)
    stopped: () => mark(null),
    addEventListener(type, fn, opts) {
      el.addEventListener(type, fn, opts)
      if (type === 'timeupdate' || type === 'play' || type === 'ended') stEvents[type].push(fn)
    },
    release() { released = true; pending = false; mark(null); releaseAudio(el); st?.release(); st = null },
  }
}
