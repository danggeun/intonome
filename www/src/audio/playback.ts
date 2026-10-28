/**
 * 녹음 재생 경로 — 소리 → (보정 게인 → 소프트 리미터) → destination.
 * 소리는 <audio>(MediaElementSource) 또는 편집기의 시간 늘이기 재생기(AudioWorklet). 둘 다 같은 출력 규칙을 탄다:
 * - autoGainControl:false 로 녹음돼 작은 파일을 녹음 시 피크(item.peak)로 보정한다(필요할 때만 게인·리미터).
 * - 첫 채널 하나를 양쪽 귀로 — 아이폰은 모노 마이크를 '2채널, 둘째는 무음' 으로 녹음한다(WebKit 259193). 우리 녹음은 늘 모노 마이크다.
 */
import { softClipCurve } from '../core/softclip.ts'
import { playbackGain } from '../core/playbackGain.ts'
import { getContext, audioSupported } from './engine.ts'

/** 재생 중으로 셀 수 있는 것 — <audio> 또는 시간 늘이기 재생기 */
export interface Playing { readonly paused: boolean; readonly ended: boolean; readonly currentTime: number }
interface Chain { nodes: AudioNode[]; gain: number }
const chains = new WeakMap<Playing, Chain>()
const active = new Set<Playing>()

/** 재생 중인 것이 하나라도 있는가 (유휴 suspend 방지) */
export const playbackActive = (): boolean => {
  for (const a of active) if (!a.paused && !a.ended) return true
  return false
}

/** source 를 출력으로 잇는다: 첫 채널 → (보정 게인 → 소프트 리미터) → destination. 반환 = 게인 */
export function routeOut(p: Playing, source: AudioNode, peak: number | undefined): number {
  const ac = getContext(), g = playbackGain(peak)
  const split = ac.createChannelSplitter(2) // 모노 입력은 두 채널로 올려 받으니 출력 0 은 어느 쪽이든 살아 있는 첫 채널
  source.connect(split)
  const nodes: AudioNode[] = [source, split]
  if (g > 1.01) {
    const gain = ac.createGain(); gain.gain.value = g
    const shaper = ac.createWaveShaper(); shaper.curve = softClipCurve(); shaper.oversample = '2x'
    split.connect(gain, 0); gain.connect(shaper); shaper.connect(ac.destination) // 모노 → destination 이 양쪽 스피커로 올린다
    nodes.push(gain, shaper)
  } else split.connect(ac.destination, 0)
  chains.set(p, { nodes, gain: g })
  return g
}

/** <audio> 를 출력 경로에 붙인다(이미 붙었으면 그대로). 반환 1 = 붙이지 못함(Web Audio 없음) — 평소대로 재생 */
export function attachGain(audio: HTMLAudioElement, peak: number | undefined): number {
  const existing = chains.get(audio); if (existing) return existing.gain
  if (!audioSupported()) return 1
  try { return routeOut(audio, getContext().createMediaElementSource(audio), peak) }
  catch { return 1 } // MediaElementSource 를 만들 수 없는 WebView — 평소대로 재생
}

/** 재생 시작 직전: 컨텍스트 재개 + 활성 표시. Web Audio 를 타는 소리는 컨텍스트가 suspended 면 무음이다 */
export function beforePlay(p: Playing): void {
  active.add(p); notify()
  if (!chains.has(p)) return
  const ac = getContext()
  if (ac.state !== 'running') void ac.resume().catch(() => {})
}
export function afterStop(p: Playing): void { if (active.delete(p)) notify() }
/** 재생이 시작되거나 멈출 때 — wake lock(편집기에서 반복 듣는 동안 화면이 꺼지지 않게)·연습 타이머(재생음을 연주로 세지 않게) */
const listeners: Array<() => void> = []
export function onPlaybackChange(fn: () => void): void { listeners.push(fn) }
function notify(): void { for (const f of listeners) f() }

/** 출력 경로를 끊는다 — WebView 의 동시 미디어 상한을 물고 있지 않게 */
export function detach(p: Playing): void {
  afterStop(p)
  const c = chains.get(p); if (!c) return
  for (const n of c.nodes) try { n.disconnect() } catch { /* 이미 끊김 */ }
  chains.delete(p)
}
/** 요소를 버린다 — 노드를 끊고 소스를 비운다(목록·편집기 공용) */
export function releaseAudio(a: HTMLAudioElement): void { detach(a); try { a.pause(); a.removeAttribute('src'); a.load() } catch { /* */ } }
/** 진단/테스트용 — 재생 중인 것들의 (게인, 진행 시각, 소리 내는 쪽). 경로에 붙지 않은 것은 게인 1 */
export const playbackDiag = (): { active: boolean; gains: number[]; times: number[]; sources: Array<'element' | 'worklet'> } => ({
  active: playbackActive(),
  gains: [...active].map(a => chains.get(a)?.gain ?? 1),
  times: [...active].map(a => a.currentTime),
  sources: [...active].map(a => typeof HTMLMediaElement !== 'undefined' && a instanceof HTMLMediaElement ? 'element' : 'worklet'),
})
