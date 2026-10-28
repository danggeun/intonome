/**
 * 배속 재생기 — 녹음을 모노로 디코드해 AudioWorklet(core/stretch, WSOLA)으로 음높이를 지키며 늘인다. 출력은 audio/playback 의 같은 경로(보정 게인·리미터·양쪽 귀).
 * <audio> 의 배속을 쓰지 않는 이유: 아이폰 WebKit 은 Web Audio 에 연결된 미디어 요소의 배속을 끊기게(느리게)·빠뜨리게(빠르게) 낸다(WebKit 240405·311000·283034).
 * 위치는 워크릿 보고(소스 시각, 그 샘플이 나가는 컨텍스트 시각)에서 배속으로 이어 계산한다.
 */
import stretchWorkletUrl from './stretch.worklet.ts?worker&url'
import { getContext } from './engine.ts'
import { routeOut, detach, type Playing } from './playback.ts'
import { decodeMono } from './decode.ts'

export type StretchEvent = 'timeupdate' | 'play' | 'ended'
export interface StretchPlayer extends Playing {
  currentTime: number
  readonly duration: number
  rate: number
  play(): void
  pause(): void
  on(fn: (e: StretchEvent) => void): void
  release(): void
}

let moduleCtx: BaseAudioContext | null = null
async function loadModule(ac: AudioContext): Promise<void> { if (moduleCtx !== ac) { await ac.audioWorklet.addModule(stretchWorkletUrl); moduleCtx = ac } }

export async function createStretchPlayer(url: string, peak: number | undefined, rate: number): Promise<StretchPlayer> {
  const ac = getContext()
  const [data] = await Promise.all([decodeMono(url, ac.sampleRate), loadModule(ac)])
  const duration = data.length / ac.sampleRate
  const node = new AudioWorkletNode(ac, 'gp-stretch', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] })
  node.port.postMessage({ type: 'load', data, rate }, [data.buffer])
  let paused = true, ended = false
  let gen = 0 // 옮길 때마다 +1 — 그 전에 출발한 워크릿 보고는 버린다
  let pos = 0, at = 0 // 기준점: 소스 시각 pos 가 컨텍스트 시각 at 에 나간다
  let r = rate
  const listeners: Array<(e: StretchEvent) => void> = []
  const emit = (e: StretchEvent): void => { for (const f of listeners) f(e) }
  const now = (): number => paused ? pos : Math.min(duration, pos + Math.max(0, ac.currentTime - at) * r)
  node.port.onmessage = (e: MessageEvent) => {
    const m = e.data; if (m.gen !== gen) return
    if (m.type === 'pos') { pos = m.pos; at = m.t; if (!paused) emit('timeupdate') }
    else if (m.type === 'ended') { paused = true; ended = true; pos = duration; emit('timeupdate'); emit('ended') }
  }
  const p: StretchPlayer = {
    duration,
    get paused() { return paused },
    get ended() { return ended },
    get currentTime() { return now() },
    set currentTime(t: number) {
      pos = Math.max(0, Math.min(duration, t)); at = ac.currentTime; ended = false; gen++
      node.port.postMessage({ type: 'seek', at: pos, gen })
      emit('timeupdate')
    },
    get rate() { return r },
    set rate(v: number) { pos = now(); at = ac.currentTime; r = v; node.port.postMessage({ type: 'rate', rate: v }) },
    play() {
      if (!paused) return
      if (ended || pos >= duration - 0.01) pos = 0 // <audio> 처럼 끝에서 누르면 처음부터
      paused = false; ended = false; at = ac.currentTime; gen++
      node.port.postMessage({ type: 'play', at: pos, gen })
      emit('play')
    },
    pause() { if (paused) return; pos = now(); paused = true; node.port.postMessage({ type: 'pause' }) },
    on(fn) { listeners.push(fn) },
    release() { paused = true; listeners.length = 0; node.port.onmessage = null; node.port.postMessage({ type: 'free' }); detach(p) },
  }
  routeOut(p, node, peak)
  return p
}
