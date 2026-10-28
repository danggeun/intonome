/**
 * 편집기 재생기 — 편집기가 쓰는 재생 동작만(위치·길이·멈춤·속도·재생/멈춤·이벤트). 이름은 <audio> 와 같다.
 * 편집기는 <audio> 를 직접 만지지 않는다: 소리를 내는 길(지금은 <audio> + 레벨 보정 그래프)은 여기서만 바뀐다.
 */
import { attachGain, beforePlay, afterStop, releaseAudio } from './playback.ts'

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

/** @param peak 녹음 시 원시 피크 — 작은 녹음은 보정 게인 그래프를 탄다 */
export function createEditorPlayer(url: string, peak: number | undefined): EditorPlayer {
  const el = new Audio(url); el.preservesPitch = true; el.playbackRate = 1.0; el.preload = 'auto'
  attachGain(el, peak)
  return {
    get currentTime() { return el.currentTime },
    set currentTime(t: number) { el.currentTime = t },
    get duration() { return el.duration },
    get paused() { return el.paused },
    get readyState() { return el.readyState },
    get playbackRate() { return el.playbackRate },
    set playbackRate(v: number) { el.playbackRate = v; el.preservesPitch = true },
    play: () => el.play(),
    pause: () => el.pause(),
    load: () => el.load(),
    willPlay: () => beforePlay(el),
    stopped: () => afterStop(el),
    addEventListener: (type, fn, opts) => el.addEventListener(type, fn, opts),
    release: () => releaseAudio(el),
  }
}
