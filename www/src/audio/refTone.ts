/**
 * 앱이 내는 음 두 가지: A 듣기와 드론. 같은 소리(삼각파, 같은 음량, 같은 페이드)이고 동시에 울리지 않는다(하나를 켜면 다른 하나는 꺼진다).
 * 단일 컨텍스트라 마이크 없이도 소리가 난다. 울리는 동안 튜너는 그 음과 정수배를 잘라내고 연주만 읽는다(core/drone.ts)
 * - A 듣기: 기준음 A 를 설정 옥타브(aOctave)로
 * - 드론: 연습 내내 켜 두는 한 음, 4옥타브
 */
import { refToneStore, droneStore, settingsStore } from '../state/index.ts'
import { droneHz, playAHz, TONE_WAVE, TONE_GAIN, TONE_FADE_S } from '../core/drone.ts'
import { getContext, onMic, audioSupported, suspendIfIdle, output, setAnalysisTone } from './engine.ts'

type Voice = { osc: OscillatorNode; gain: GainNode; ctx: AudioContext }

function startVoice(hz: number): Voice {
  const ctx = getContext(), osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime
  osc.type = TONE_WAVE; osc.frequency.value = hz; osc.connect(gain); gain.connect(output())
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(TONE_GAIN, t + TONE_FADE_S)
  osc.start()
  return { osc, gain, ctx }
}
function stopVoice(v: Voice | null): void {
  if (!v) return
  try {
    const t = v.ctx.currentTime
    v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t)
    v.gain.gain.exponentialRampToValueAtTime(.001, t + TONE_FADE_S); v.osc.stop(t + TONE_FADE_S)
  } catch { /* 이미 정지 */ }
}
function retune(v: Voice, hz: number): void {
  v.osc.frequency.setTargetAtTime(hz, v.ctx.currentTime, .02)
  setAnalysisTone(hz)
}

// A 듣기
let aVoice: Voice | null = null
export function stopRefNote(): void {
  if (!refToneStore.get().active && !aVoice) return
  refToneStore.set({ active: false })
  stopVoice(aVoice); aVoice = null
  setAnalysisTone(null)
  setTimeout(suspendIfIdle, 100)
}
/** 튜너 헤더의 'A 듣기': 기준음(refHz) A 를 설정 옥타브(aOctave)로 토글 */
export function toggleRefA(): void {
  if (refToneStore.get().active) { stopRefNote(); return }
  if (!audioSupported()) return
  stopDrone()
  const s = settingsStore.get(), hz = playAHz(s.refHz, s.aOctave)
  aVoice = startVoice(hz)
  refToneStore.set({ active: true })
  setAnalysisTone(hz)
}
onMic('beforeClose', stopRefNote) // 마이크를 끄면 A 듣기도 정지 (드론은 계속: 튜너와 따로 가는 연습 소리)

// 드론
let droneVoice: Voice | null = null
/** 음(0 = 도 … 11 = 시)으로 드론을 켠다 */
export function startDrone(pitchClass: number): void {
  if (!audioSupported()) return
  stopRefNote()
  stopVoice(droneVoice)
  const hz = droneHz(pitchClass, settingsStore.get().refHz)
  droneVoice = startVoice(hz)
  droneStore.set({ pitchClass })
  setAnalysisTone(hz)
}
export function stopDrone(): void {
  if (droneStore.get().pitchClass === null && !droneVoice) return
  droneStore.set({ pitchClass: null })
  stopVoice(droneVoice); droneVoice = null
  setAnalysisTone(null)
  setTimeout(suspendIfIdle, 100)
}
// 기준음(A = …Hz)이나 A 듣기 높이를 바꾸면 울리는 음도 바로 따라간다. 튜너의 잘라내기도 새 주파수로
settingsStore.select(s => s.refHz, ref => {
  const pc = droneStore.get().pitchClass
  if (pc !== null && droneVoice) retune(droneVoice, droneHz(pc, ref))
  if (aVoice) retune(aVoice, playAHz(ref, settingsStore.get().aOctave))
})
settingsStore.select(s => s.aOctave, o => { if (aVoice) retune(aVoice, playAHz(settingsStore.get().refHz, o)) })
