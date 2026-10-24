import { describe, test, expect } from 'vitest'
import { createSequencer, CLICK_DUR_S, type SubDiv } from './sequencer.ts'
import { createAnalyzer } from '../pitch/analyzer.ts'

// 메트로놈을 켠 채 연주: 워커와 같은 규칙으로 클릭 구간(도착 −10 ms ~ 클릭 길이 + 60 ms)과 겹친 창에 muted 를 준다.
// 2.5.2 까지는 그 창을 통째로 버려서, 클릭 간격이 0.2 s 보다 짧은 세분(16분 66 bpm·셋잇단 86·8분 130 이상)에서 튜너가 아무것도 못 봤다
const SR = 48000, WIN = 4096, HOP = 1024
type Note = { hz: number; from: number; to: number }
function run(o: { bpm: number; subDiv: SubDiv; clickGain: number; ref: number; notes: Note[]; sec: number }) {
  const n = Math.round(o.sec * SR)
  const seq = createSequencer(SR, { bpm: o.bpm, timeSig: 4, subDiv: o.subDiv, volume: 1, muted: false, refHz: o.ref }); seq.start(0)
  const clk = new Float32Array(n), out = new Float32Array(128), marks: number[] = []
  for (let s = 0; s < n; s += 128) { out.fill(0); for (const ev of seq.render(out, s)) marks.push(ev.sample / SR); clk.set(out.subarray(0, Math.min(128, n - s)), s) }
  const x = new Float32Array(n); let ph = 0, seed = 3
  for (let i = 0; i < n; i++) { const t = i / SR; seed = (seed * 1664525 + 1013904223) >>> 0
    const note = o.notes.find(m => t >= m.from && t < m.to); let v = 0
    if (note) { const u = t - note.from; ph += 2 * Math.PI * note.hz * Math.pow(2, 5 * Math.sin(2 * Math.PI * 5.5 * t) / 1200) / SR
      let s = 0; for (let h = 1; h <= 12; h++) s += Math.sin(ph * h + h) / h; v = 0.12 * s * Math.min(1, u / 0.03) * Math.min(1, (note.to - t) / 0.02) }
    x[i] = v + clk[i]! * o.clickGain + (seed / 2 ** 32 - .5) * 0.002 }
  const an = createAnalyzer({ sampleRate: SR, windowSize: WIN, hzMin: 40, hzMax: 4200 }); an.setSettings({ rmsMin: .005, smoothing: .2, refHz: o.ref, tolCents: 15 })
  const frames: Array<{ t: number; midi: number }> = []
  for (let end = WIN; end <= n; end += HOP) {
    const t = end / SR, t0 = t - WIN / SR
    const muted = marks.some(at => at <= t && t0 < at + CLICK_DUR_S + 0.06 && t > at - 0.01)
    const f = an.process(x.subarray(end - WIN, end), muted); frames.push({ t, midi: f.hz > 0 ? f.midi : -1 })
  }
  return frames
}
const midiOf = (hz: number, ref: number) => Math.round(69 + 12 * Math.log2(hz / ref))

describe('the tuner keeps reading with the metronome on, at any tempo and subdivision', () => {
  const tempos: Array<[number, SubDiv]> = [[60, 1], [130, 2], [160, 2], [86, 3], [120, 3], [66, 4], [100, 4], [160, 4]]
  for (const gain of [0.3, 1]) test.each(tempos)(`a held A4, clicks at ${gain}× — %i bpm, subdivision %s: the note shows in every frame, never another note`, (bpm, subDiv) => {
    const fr = run({ bpm, subDiv, clickGain: gain, ref: 440, notes: [{ hz: 440, from: 0, to: 6 }], sec: 6 }).filter(f => f.t >= 1)
    expect(fr.filter(f => f.midi === 69).length / fr.length).toBeGreaterThan(0.99)
    expect(fr.filter(f => f.midi >= 0 && f.midi !== 69).length).toBe(0)
  }, 20000)
  test.each([[100, 4], [120, 2]] as Array<[number, SubDiv]>)('clicks alone (%i bpm, %s), even loud: never shown as a note', (bpm, subDiv) => {
    for (const gain of [1, 3]) expect(run({ bpm, subDiv, clickGain: gain, ref: 440, notes: [], sec: 4 }).filter(f => f.midi >= 0).length).toBe(0)
  }, 20000)
  test.each([[415], [442], [466]])('an A major scale under 16ths at 100 bpm, A = %i: every note shows within 0.2 s and stays', ref => {
    const notes = [0, 2, 4, 5, 7, 9, 11, 12].map((s, k) => ({ hz: ref * Math.pow(2, s / 12), from: 0.3 + k * 0.5, to: 0.3 + (k + 1) * 0.5 }))
    const fr = run({ bpm: 100, subDiv: 4, clickGain: 0.3, ref, notes, sec: 4.8 })
    for (const m of notes) {
      const want = midiOf(m.hz, ref), inNote = fr.filter(f => f.t >= m.from && f.t < m.to)
      const first = inNote.find(f => f.midi === want); expect(first, `${want}`).toBeDefined(); expect(first!.t - m.from).toBeLessThan(0.2)
      const steady = inNote.filter(f => f.t - m.from > 0.2); expect(steady.filter(f => f.midi === want).length / steady.length).toBeGreaterThan(0.95)
    }
  }, 30000)
  test.each([[-25], [25]])('the notes on either side of each click pitch, played %i cents off, still read under 16ths at 120 bpm', off => {
    const notes = [9, 10, 15, 16, 24, 25].map((s, k) => ({ hz: 440 * Math.pow(2, (s + off / 100) / 12), from: 0.3 + k * 0.8, to: 0.3 + (k + 1) * 0.8 }))
    const fr = run({ bpm: 120, subDiv: 4, clickGain: 0.3, ref: 440, notes, sec: 5.3 })
    for (const m of notes) { const want = midiOf(m.hz, 440), steady = fr.filter(f => f.t >= m.from + 0.25 && f.t < m.to); expect(steady.filter(f => f.midi === want).length / steady.length, `${want}`).toBeGreaterThan(0.95) }
  }, 30000)
})
