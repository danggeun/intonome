import { describe, test, expect } from 'vitest'
import { createAnalyzer } from './analyzer.ts'
import type { TrackerParams } from './tracker.ts'
import { keepInTrace, buildSegments } from '../trace.ts'

const sr = 44100, N = 4096
const tone = (f: number, harm = 4) => Float32Array.from({ length: N }, (_, i) => { let s = 0; for (let h = 1; h <= harm; h++) s += Math.sin(2 * Math.PI * f * h * i / sr) / h; return 0.3 * s })

/** 같은 창을 여러 번 넣어 트래커가 음이름을 확정하게 한 뒤 마지막 프레임 */
function settle(refHz: number, playedHz: number) {
  const an = createAnalyzer({ sampleRate: sr, windowSize: N }); an.setSettings({ refHz, tolCents: 15, rmsMin: .008 })
  let f = an.process(tone(playedHz)); for (let i = 0; i < 12; i++) f = an.process(tone(playedHz)); return f
}

describe('double bass below E1 — 5-string B0, C extension, a loose E string', () => {
  // 2.5.7 까지 hzMin 40: 38.9 Hz(60 ¢ 낮은 E1)는 YIN 탐색 끝의 포물선이 범위 밖으로 외삽돼 도♯1·도1 이 매 프레임 튀었고, B0·C1 은 아무것도 안 떴다
  const bass = (hz: number, sec = 1.5, fundDb = -12): Float32Array => { // 베이스는 기본음이 약하고 배음이 많다
    const x = new Float32Array(Math.round(sec * sr)); let ph = 0
    for (let i = 0; i < x.length; i++) { ph += 2 * Math.PI * hz / sr; let s = 0; for (let h = 1; h <= 24; h++) s += (h === 1 ? 10 ** (fundDb / 20) : 1 / h ** 0.9) * Math.sin(ph * h + h * 0.4); x[i] = 0.08 * s * Math.min(1, i / (0.1 * sr)) }
    return x
  }
  const read = (hz: number, refHz = 440) => {
    const a = createAnalyzer({ sampleRate: sr, windowSize: N }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz, tolCents: 10 })
    const x = bass(hz), midis: number[] = [], cents: number[] = []; let first = -1
    for (let end = N; end <= x.length; end += 1024) { const f = a.process(x.subarray(end - N, end)); if (f.hz > 0) { if (first < 0) first = end / sr; midis.push(f.midi); cents.push(f.cents) } }
    return { first, midis, cents }
  }
  test.each([['B0 (5-string)', 30.87, 23], ['C1 (extension)', 32.70, 24], ['E♭1 (loose E string, −100 ¢)', 38.89, 27], ['E1 −60 ¢ (reads E♭1 +40)', 41.2 * 2 ** (-60 / 1200), 27]])('%s reads its own note, steadily, within 0.3 s', (_, hz, midi) => {
    const r = read(hz)
    expect(r.first).toBeGreaterThan(0); expect(r.first).toBeLessThan(0.3)
    expect(r.midis.filter(m => m === midi).length / r.midis.length, `note ${midi} in every frame (${new Set(r.midis).size} different notes seen)`).toBeGreaterThan(0.98)
    const late = r.cents.slice(10); expect(Math.max(...late) - Math.min(...late), 'the number does not jump around').toBeLessThan(8)
  })
})

describe('analyzer: reference pitch (refHz) correction', () => {
  // 리뷰에서 잡은 결함: 트래커 격자가 A=440 이라 |오프셋| > 50 ¢ (바로크 415, 466) 에서 이웃 반음으로 라벨링됐다
  test.each([[442, 442], [440, 440], [432, 432], [425, 425], [415, 415], [466, 466], [410, 410]])('refHz=%i 에서 그 주파수는 라4 0 ¢', (ref, hz) => {
    const f = settle(ref, hz)
    expect(f.midi).toBe(69); expect(Math.abs(f.cents)).toBeLessThanOrEqual(2); expect(f.inTune).toBe(true)
    expect(Math.abs(1200 * Math.log2(f.hz / hz))).toBeLessThan(3) // 표시 주파수는 실제 값으로 되돌려진다
  })
  test('at refHz=415 an A string at 440 reads near A♯4 (+2 ¢), not A4 +102 ¢', () => {
    const f = settle(415, 440)
    expect(f.midi).toBe(70); expect(Math.abs(f.cents)).toBeLessThanOrEqual(3)
  })
  test('at refHz=442, 440 reads A4 −8 ¢ (in tune at ±15)', () => {
    const f = settle(442, 440)
    expect(f.midi).toBe(69); expect(Math.round(f.cents)).toBe(-8); expect(f.inTune).toBe(true)
  })
  test('cello C2 (65.4 Hz) is C2 regardless of refHz', () => {
    for (const ref of [415, 442, 466]) { const f = settle(ref, 65.41 * ref / 440); expect(f.midi).toBe(36) }
  })
})

describe('turning the A = drum while a note sounds', () => {
  // 2.5.7 까지: 트래커 상태가 440 정규화 공간에 있고 refK 만 즉시 바뀌어, 440 Hz 를 켠 채 442 로 돌리면 그 프레임에 "라4 0 ¢ 442.0 Hz" 가 뜨고
  // 숫자·초록·Hz 가 0.3~0.9 s 에 걸쳐 제자리로 미끄러졌다
  const sr48 = 48000, N48 = 4096, HOP = 1024
  const held = (hz: number, sec: number): Float32Array => { const x = new Float32Array(Math.round(sec * sr48)); let ph = 0; for (let i = 0; i < x.length; i++) { ph += 2 * Math.PI * hz / sr48; let s = 0; for (let h = 1; h <= 10; h++) s += Math.sin(ph * h + h) / h; x[i] = 0.1 * s * Math.min(1, i / (0.05 * sr48)) } return x }
  test.each([[440, 442, 69, -8], [440, 415, 70, 2], [440, 466, 68, 1], [442, 440, 69, 8]])('%i Hz held, A = → %i: the very next frame reads %s at %i ¢ with the Hz unchanged', (hz, ref, midi, cents) => {
    const a = createAnalyzer({ sampleRate: sr48, windowSize: N48 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: 10 })
    const x = held(hz, 2); let end = N48
    for (; end / sr48 < 1; end += HOP) a.process(x.subarray(end - N48, end))
    a.setSettings({ refHz: ref })
    const f = a.process(x.subarray(end - N48, end))
    expect(f.midi).toBe(midi); expect(Math.abs(f.readCents - cents)).toBeLessThanOrEqual(1); expect(Math.abs(f.hz - hz)).toBeLessThan(1)
    expect(f.inTune).toBe(Math.abs(cents) <= 10)
  })
  test('dragging the drum 440 → 443 in 1 Hz steps every 100 ms: the Hz readout never follows the drum', () => {
    const a = createAnalyzer({ sampleRate: sr48, windowSize: N48 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: 10 })
    const x = held(440, 3); let end = N48, ref = 440, k = 0
    for (; end + HOP <= x.length; end += HOP) {
      if (end / sr48 > 1 && ref < 443 && ++k % 5 === 0) { ref++; a.setSettings({ refHz: ref }) }
      const f = a.process(x.subarray(end - N48, end))
      if (end / sr48 > 0.5) { expect(Math.abs(f.hz - 440), `t=${(end / sr48).toFixed(2)} ref ${ref}`).toBeLessThan(1); expect(f.midi).toBe(69) }
    }
    expect(ref).toBe(443)
  })
})

describe('spectral match penalty', () => {
  /** 두 음이 겹친 신호 — 가상 기본음이 생기는 상황을 합성으로 재현 */
  function doubleStop(sr: number, n: number, f1: number, f2: number): Float32Array {
    const x = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / sr
      // 각 음은 기본음 + 배음 몇 개 (현악기처럼)
      for (const [f, a] of [[f1, .5], [f2, .5]] as const)
        for (let k = 1; k <= 5; k++) x[i] = x[i]! + a / k * Math.sin(2 * Math.PI * f * k * t)
    }
    return x
  }

  test('doesn’t show an unplayed lower note in a double stop', () => {
    const sr = 48000, N = 4096
    const a = createAnalyzer({ sampleRate: sr })
    a.setSettings({ rmsMin: .014, smoothing: .14, refHz: 440, tolCents: 15 })
    // A4(440) + E5(659.26) — 완전5도. 가상 기본음은 약 220 Hz 자리에 생길 수 있다.
    const x = doubleStop(sr, sr, 440, 659.26)
    const shown: number[] = []
    for (let end = N; end <= x.length; end += 1024) shown.push(a.process(x.subarray(end - N, end)).hz)
    const last = shown.slice(-10).filter(h => h > 0)
    // 표시된 값이 있다면 실제로 연주한 두 음 중 하나여야 한다 (그 아래 옥타브가 아니라)
    for (const h of last) expect(h).toBeGreaterThan(400)
  })

  test('the playing detector isn’t affected by the penalty — for single notes and double stops', () => {
    const sr = 48000, N = 4096
    // 페널티가 감지기 경로에 새면 이 값이 달라진다. 두 신호 모두에서 연주로 판정되어야 한다.
    for (const x of [
      Float32Array.from({ length: sr }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 440 * i / sr) + 0.2 * Math.sin(2 * Math.PI * 880 * i / sr)),
      doubleStop(sr, sr, 440, 659.26),
    ]) {
      const a = createAnalyzer({ sampleRate: sr })
      a.setSettings({ rmsMin: .014, smoothing: .14, refHz: 440, tolCents: 15 })
      let playingFrames = 0, total = 0
      for (let end = N; end <= x.length; end += 1024) { total++; if (a.process(x.subarray(end - N, end)).playing) playingFrames++ }
      expect(playingFrames / total).toBeGreaterThan(0.6) // 연주 중인 신호는 연주로 잡혀야 한다
    }
  })

  test('normal single notes aren’t penalized', () => {
    const sr = 48000, N = 4096
    const a = createAnalyzer({ sampleRate: sr })
    a.setSettings({ rmsMin: .014, smoothing: .14, refHz: 440, tolCents: 15 })
    const x = Float32Array.from({ length: sr }, (_, i) => 0.4 * Math.sin(2 * Math.PI * 440 * i / sr) + 0.15 * Math.sin(2 * Math.PI * 880 * i / sr))
    let last = -1
    for (let end = N; end <= x.length; end += 1024) last = a.process(x.subarray(end - N, end)).hz
    expect(Math.abs(1200 * Math.log2(last / 440))).toBeLessThan(5)
  })
})

describe('one note, bowed again and again, reads as one unbroken line', () => {
  const sr = 48000, N = 4096, HOP = 1024
  /** 한 음을 활로 여러 번 긋는 소리: 활마다 짧은 틈(−30 dB) → 어택(소음 섞인 흔들리는 음정, 세기 올라감) → 지속. 5.5 Hz 비브라토 ±5 ¢. 잡음은 시드 고정 */
  function bowed(hz: number, strokeS: number, gapS: number, strokes = 6, seed = 9, ATT = 0.08, ATT_NOISE_DB = -10): Float32Array {
    const WOB = 40, LEAD = 0.4
    const randn = () => { let u = 0, v = 0; while (!u) u = (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32; while (!v) v = (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
    const x = new Float32Array(Math.round((LEAD + strokes * strokeS) * sr)); let ph = 0, hp = 0, hpIn = 0
    for (let i = 0; i < x.length; i++) {
      const t = i / sr; if (t < LEAD) continue
      const u = (t - LEAD) % strokeS, gap = u < gapS, att = !gap && u < gapS + ATT, k = att ? (u - gapS) / ATT : 1
      const amp = gap ? 10 ** (-30 / 20) : att ? 0.3 + 0.7 * k : 1
      const f = hz * 2 ** ((5 * Math.sin(2 * Math.PI * 5.5 * t) + (att ? WOB * (1 - k) * randn() * 0.3 : 0)) / 1200)
      ph += 2 * Math.PI * f / sr; let s = 0; for (let h = 1; h <= 16; h++) { if (f * h > sr * .45) break; s += h ** -1.1 * (h % 2 ? 1 : .79) * Math.sin(ph * h) }
      const r = randn(), y = .95 * (hp + r - hpIn); hpIn = r; hp = y // 1차 하이패스 백색잡음 = 활 소음
      const noiseDb = att ? ATT_NOISE_DB * (1 - k) + -30 * k : -30
      x[i] = (s * .35 + y * 10 ** (noiseDb / 20) * 0.3) * amp
    }
    return x
  }
  const expectMidi = (hz: number) => Math.round(69 + 12 * Math.log2(hz / 440))

  // 2.4.6 까지: 활을 바꾸는 순간의 거친 한 프레임이 옥타브로 튀면 '안정성 게이트' 가 네 프레임을 비웠고, 트레이스가 거기서 끊겼다 — 테스터의 "라~ 라~ 라~ 가 자꾸 끊긴다"
  const cases: Array<[string, number, number, number, number, number]> = []
  for (const seed of [9, 21, 33]) {
    for (const [name, hz] of [['G3', 196], ['A4', 440], ['A2', 110], ['E5', 659.26]] as const) cases.push([`${name}, 40 ms between strokes, 80 ms attack, noise seed ${seed}`, hz, 0.04, seed, 0.08, -10])
    for (const [name, hz] of [['G3', 196], ['D3', 146.83]] as const) cases.push([`${name}, 50 ms between strokes, 100 ms rougher attack, noise seed ${seed}`, hz, 0.05, seed, 0.10, -8])
    for (const [name, hz] of [['G3', 196], ['A4', 440]] as const) cases.push([`${name}, 250 ms between strokes (lifted bow), noise seed ${seed}`, hz, 0.25, seed, 0.08, -10])
  }
  test.each(cases)('%s: the note never goes to "--", never changes, and the trace is one line', (_, hz, gap, seed, att, attNoiseDb) => {
    const x = bowed(hz, 0.5, gap, 6, seed, att, attNoiseDb)
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .20, refHz: 440, tolCents: 15 })
    const cents: Array<number | null> = [], midi: Array<number | null> = []; let shown = false
    for (let end = N; end <= x.length; end += HOP) {
      const f = a.process(x.subarray(end - N, end))
      if (!shown) { if (f.hz <= 0) { expect(end / sr, 'the first stroke shows within 0.25 s').toBeLessThan(0.4 + 0.25); continue } shown = true } // 첫 활의 음이름이 뜬 뒤부터
      expect(f.hz, `t=${(end / sr).toFixed(2)} s shows a note`).toBeGreaterThan(0)
      expect(f.midi, `t=${(end / sr).toFixed(2)} s is still the same note`).toBe(expectMidi(hz))
      const keep = keepInTrace(f.hz, f.held); cents.push(keep ? f.cents : null); midi.push(keep ? f.midi : null)
    }
    expect(cents.length).toBeGreaterThan(100)
    expect(cents.filter(c => c === null).length, 'no empty frame in the trace').toBe(0)
    const { segs, breaks } = buildSegments(cents, midi) // 선분 [i, i+1] 의 목록 — 빠진 프레임 없이 끝까지 이어져야 한다
    expect(segs.length, 'a line piece between every pair of frames').toBe(cents.length - 1); expect(breaks).toBe(0)
    for (let i = 1; i < segs.length; i++) expect(segs[i]![0], `line continues at frame ${segs[i]![0]}`).toBe(segs[i - 1]![1])
  })

  test('after the last stroke the note lingers about half a second, then "--"', () => {
    const x = bowed(440, 0.5, 0.04, 2), a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .20, refHz: 440, tolCents: 15 })
    const tail = new Float32Array(sr), all = new Float32Array(x.length + tail.length); all.set(x) // 1 s of silence after the sound
    let lastShown = -1, soundEnd = x.length / sr
    for (let end = N; end <= all.length; end += HOP) if (a.process(all.subarray(end - N, end)).hz > 0) lastShown = end / sr
    const linger = lastShown - soundEnd
    expect(linger).toBeGreaterThan(0.35); expect(linger).toBeLessThan(0.65)
  })
})

describe('short detached notes straight after a rest (spiccato, staccato) show from the first or second note', () => {
  // 쉬었다가 스피카토로 음계를 시작하면 음마다 유효 프레임이 4~5 개뿐이고 다음 음은 음높이가 달라 처음부터 다시 센다 —
  // 시작 조건이 7 프레임이면 16분음표 100~125 bpm 음계가 끝까지 안 떴다(합성 15 장면 중 3). 6 프레임은 둘째 음에서 띄운다
  const sr = 48000, N = 4096, HOP = 1024
  /** 음계 8 음: 활이 닿은 soundS 동안 소리, 떼면 현 울림이 ringDb 에서 ringS 로 사라지며 gapS 뒤 다음 음. 앞 0.6 s 무음(배경 −55 dBFS) */
  function spiccato(soundS: number, gapS: number, ringDb: number, ringS: number): Float32Array {
    const midis = [69, 71, 73, 74, 76, 78, 80, 81], per = Math.round((soundS + gapS) * sr), lead = Math.round(0.6 * sr)
    const x = new Float32Array(lead + per * midis.length + Math.round(0.3 * sr)); let seed = 11
    for (let i = 0; i < x.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; x[i] = (seed / 2 ** 32 - 0.5) * 0.004 }
    midis.forEach((m, k) => {
      const hz = 442 * 2 ** ((m - 69) / 12), s0 = lead + k * per, g0 = Math.round(soundS * sr); let ph = 0
      for (let i = 0; i < per; i++) {
        const t = i / sr; ph += 2 * Math.PI * hz / sr; let v = 0; for (let h = 1; h <= 12; h++) v += Math.sin(ph * h + h * 0.7) / h ** 1.1
        const env = i < g0 ? Math.min(1, t / 0.015, (soundS - t) / 0.01) : 10 ** (ringDb / 20) * Math.exp(-((i - g0) / sr) / ringS)
        x[s0 + i] = x[s0 + i]! + 0.15 * v * Math.max(0, env)
      }
    })
    return x
  }
  function firstNote(x: Float32Array, soundS: number, gapS: number, tracker?: Partial<TrackerParams>): number {
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200, tracker }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 442, tolCents: 15 })
    for (let end = N; end <= x.length; end += HOP) if (a.process(x.subarray(end - N, end)).hz > 0) return Math.floor((end / sr - 0.6) / (soundS + gapS)) + 1
    return 99
  }
  test.each([
    ['16ths at 100 bpm, stopped notes (little ring)', 0.1, 0.05, -18, 0.15],
    ['16ths at 125 bpm, open-ish strings (ring)', 0.08, 0.04, -10, 0.3],
    ['8ths at 150 bpm with gaps', 0.1, 0.1, -40, 0.05],
  ])('%s: a note is on the screen by the second note (seven frames show these late or never)', (_, sound, gap, ringDb, ringS) => {
    const x = spiccato(sound, gap, ringDb, ringS)
    expect(firstNote(x, sound, gap)).toBeLessThanOrEqual(2)
    expect(firstNote(x, sound, gap, { acquireFrames: 3, acquireCents: 20, acquireGap: 0 })).toBe(1) // 2.5.6: 첫 음부터
  })
  test('the fastest stopped spiccato (16ths at 125 bpm, little ring) still shows inside the passage', () => {
    expect(firstNote(spiccato(0.08, 0.04, -18, 0.15), 0.08, 0.04)).toBeLessThanOrEqual(6) // 여섯째 음(0.7 s)까지는 뜬다 — 7 프레임이면 끝까지 안 뜬다
  })
  test('with seven frames the fast scales show late or not at all — the reason the rule is six', () => {
    expect(firstNote(spiccato(0.1, 0.05, -18, 0.15), 0.1, 0.05, { acquireFrames: 7 })).toBeGreaterThan(2)
    expect(firstNote(spiccato(0.08, 0.04, -10, 0.3), 0.08, 0.04, { acquireFrames: 7 })).toBeGreaterThan(2)
    expect(firstNote(spiccato(0.08, 0.04, -18, 0.15), 0.08, 0.04, { acquireFrames: 7 })).toBeGreaterThan(8)
  })
})

describe('nothing is played — the tuner shows nothing', () => {
  // 피드백(2026-10-24): 바깥에서 그냥 켜 두면 주변 소리에 음이 틱틱 떴다. 말소리 음절·새소리·딸깍은 짧거나 피치가 미끄러진다 —
  // 같은 음으로 여러 프레임 이어질 때만 새로 띄운다 (2.5.1 은 3 프레임, 2.5.7 은 6 프레임)
  const sr = 48000, N = 4096, HOP = 1024
  /** 야외 20 s: 분홍+갈색 배경 −45/−40 dBFS, 사건(멀리서 말소리 음절·새·딸깍·차·바람) 최대 −24 dBFS, 시드 고정 */
  function ambient(seedIn: number, sec = 20): Float32Array {
    let seed = seedIn; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
    const randn = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }
    const n = Math.round(sec * sr), x = new Float32Array(n), db = (d: number) => 10 ** (d / 20)
    { let b0 = 0, b1 = 0, b2 = 0, br = 0; for (let i = 0; i < n; i++) { const w = randn(); b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; br = 0.997 * br + w * 0.08; x[i] = (b0 + b1 + b2) * 0.25 * db(-45) * 3 + br * db(-40) * 0.5 } }
    const add = (t0: number, dur: number, fn: (t: number, u: number) => number) => { const s = Math.round(t0 * sr), m = Math.round(dur * sr); for (let i = 0; i < m && s + i < n; i++) x[s + i] = x[s + i]! + fn(i / sr, i / m) }
    for (let t = 1; t < sec - 1;) {
      const k = rnd(), lvl = -24 - rnd() * 12
      if (k < 0.35) { const f0 = 100 + rnd() * 160, dur = 0.08 + rnd() * 0.17, glide = (rnd() - .5) * .6; let ph = rnd() * 6
        add(t, dur, (_, u) => { ph += 2 * Math.PI * f0 * (1 + glide * u) / sr; let s = 0; for (let h = 1; h <= 12; h++) s += Math.sin(ph * h) / h * (h === 2 || h === 3 ? 1.5 : 1); return s * db(lvl) * 0.3 * Math.sin(Math.PI * u) }); t += dur + 0.05 + rnd() * 0.4 }
      else if (k < 0.55) { const f0 = 2000 + rnd() * 2000, dur = 0.03 + rnd() * 0.05; let ph = 0; add(t, dur, (_, u) => { ph += 2 * Math.PI * f0 * (1 + 0.3 * u) / sr; return Math.sin(ph) * db(lvl) * Math.sin(Math.PI * u) }); t += dur + 0.1 + rnd() * 0.6 }
      else if (k < 0.7) { const dur = 0.02 + rnd() * 0.03; add(t, dur, (_, u) => randn() * db(lvl) * Math.exp(-u * 6)); t += dur + 0.2 + rnd() * 1.0 }
      else if (k < 0.82) { const dur = 2 + rnd() * 2; let b = 0; add(t, dur, (_, u) => { b = 0.99 * b + randn() * 0.14; return b * db(lvl - 6) * Math.sin(Math.PI * u) }); t += dur + rnd() * 1.5 }
      else { const dur = 1 + rnd() * 2; let b = 0; add(t, dur, (_, u) => { b = 0.998 * b + randn() * 0.06; return b * db(lvl) * Math.sin(Math.PI * u) }); t += dur + rnd() * 2 }
    }
    return x
  }
  test.each([[1], [2], [3]])('20 s of outdoor ambience (seed %i): no note, no playing time', seed => {
    const x = ambient(seed), a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 442, tolCents: 15 })
    let shown = 0, playing = 0
    for (let end = N; end <= x.length; end += HOP) { const f = a.process(x.subarray(end - N, end)); if (f.hz > 0) shown++; if (f.playing) playing++ }
    expect(shown, 'frames with a note').toBe(0); expect(playing, 'frames counted as playing').toBe(0)
  }, 20000)
  test('a note that starts over the same ambience still shows within 250 ms', () => {
    const x = ambient(1, 6), f0 = 442 * Math.pow(2, -14 / 12); let ph = 0 // G3
    for (let i = Math.round(3 * sr); i < x.length; i++) { const t = i / sr - 3; ph += 2 * Math.PI * f0 * 2 ** (5 * Math.sin(2 * Math.PI * 5.3 * t) / 1200) / sr; let s = 0; for (let h = 1; h <= 12; h++) s += Math.sin(ph * h + h) / h; x[i] = x[i]! + 0.1 * s * Math.min(1, t / 0.08) }
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 442, tolCents: 15 })
    let first = -1
    for (let end = N; end <= x.length; end += HOP) { const f = a.process(x.subarray(end - N, end)); if (f.hz > 0 && first < 0) { first = end / sr - 3; expect(f.midi).toBe(55) } }
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(0.25) // 2.5.7: 무음에서 새로 띄우려면 6 프레임 — 말소리 모음이 틱틱 뜨지 않게(2.5.1 은 3 프레임, 0.15 s)
  })
  /** 조용한 방에서 가까이 말한 모음 하나: 0.5 s 무음 → 모음(f0, 프레임당 glide st/s 로 미끄러짐, 포먼트 700/1200 Hz) → 무음 */
  function vowel(dur: number, f0: number, glide: number): Float32Array {
    const n = Math.round((dur + 1) * sr), x = new Float32Array(n), s0 = Math.round(0.5 * sr), m = Math.round(dur * sr), ramp = 0.015 * sr
    let seed = 7, ph = 0; for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; x[i] = (seed / 2 ** 32 - 0.5) * 2e-4 }
    const amp = (hz: number) => 1 / (1 + ((hz - 700) / 150) ** 2) + 0.6 / (1 + ((hz - 1200) / 200) ** 2) + 0.05
    for (let i = 0; i < m; i++) {
      const t = i / sr, f = f0 * 2 ** (glide * t / 12); ph += 2 * Math.PI * f / sr
      let s = 0; for (let h = 1; h * f < 4000; h++) s += Math.sin(ph * h) * amp(h * f)
      x[s0 + i] = x[s0 + i]! + 0.06 * s * Math.min(1, i / ramp, (m - i) / ramp)
    }
    return x
  }
  function shownFrames(x: Float32Array, tracker?: Partial<TrackerParams>): number {
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200, tracker }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 442, tolCents: 15 })
    let shown = 0; for (let end = N; end <= x.length; end += HOP) if (a.process(x.subarray(end - N, end)).hz > 0) shown++
    return shown
  }
  test.each([[0.06, 0], [0.08, 0], [0.06, 4], [0.08, -4]])('a lone spoken vowel of %s s (gliding %s st/s) after silence shows nothing', (dur, glide) => {
    for (const f0 of [120, 210]) {
      expect(shownFrames(vowel(dur, f0, glide), { acquireFrames: 3, acquireCents: 20, acquireGap: 0 }), `2.5.6 rule, f0 ${f0}`).toBeGreaterThan(0) // 재현: 예전 조건에선 떴다
      expect(shownFrames(vowel(dur, f0, glide)), `f0 ${f0}`).toBe(0)
    }
  })
  test('a held note (or a long sung vowel) of 0.3 s does show', () => {
    expect(shownFrames(vowel(0.3, 210, 0))).toBeGreaterThan(0)
  })
})

describe('the number and the green are calm; the line stays live', () => {
  // 비브라토 ±15 ¢ 에서 숫자가 초당 43 번, 허용 경계(+14 ¢)에서 초록이 초당 9 번 바뀌었다 (2.5.2). 숫자와 초록은 0.37 s 평균으로 읽고, 선은 매 프레임 그대로
  const sr = 48000, N = 4096, HOP = 1024
  function frames(centsAt: (t: number) => number, sec: number, tol = 15) {
    const n = Math.round(sec * sr), x = new Float32Array(n); let ph = 0
    for (let i = 0; i < n; i++) { const t = i / sr; ph += 2 * Math.PI * 440 * Math.pow(2, centsAt(t) / 1200) / sr; let s = 0; for (let h = 1; h <= 10; h++) s += Math.sin(ph * h + h) / h; x[i] = 0.12 * s * Math.min(1, t / 0.08) }
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: tol })
    const out: Array<{ t: number; read: number; cents: number; inTune: boolean }> = []
    for (let end = N; end <= n; end += HOP) { const f = a.process(x.subarray(end - N, end)); if (f.hz > 0) out.push({ t: end / sr, read: f.readCents, cents: f.cents, inTune: f.inTune }) }
    return out
  }
  const changesPerS = (o: ReturnType<typeof frames>, k: 'read' | 'inTune') => { const s = o.filter(f => f.t > 0.8); let c = 0; for (let i = 1; i < s.length; i++) if (s[i]![k] !== s[i - 1]![k]) c++; return c / (s.length * HOP / sr) }
  test.each([[5.5], [4.5], [6.5]])('vibrato ±15 ¢ at %s Hz: the number barely moves, the line still swings', hz => {
    const o = frames(t => 15 * Math.sin(2 * Math.PI * hz * t), 4)
    expect(changesPerS(o, 'read')).toBeLessThan(1)
    const late = o.filter(f => f.t > 0.8); expect(Math.max(...late.map(f => Math.abs(f.read)))).toBeLessThanOrEqual(2)
    expect(Math.max(...late.map(f => f.cents)) - Math.min(...late.map(f => f.cents))).toBeGreaterThan(4) // 선은 비브라토를 보여 준다
  })
  test('+14 ¢ with ±6 ¢ vibrato at a ±15 tolerance: green stays on, number and green agree', () => {
    const o = frames(t => 14 + 6 * Math.sin(2 * Math.PI * 5.5 * t), 4)
    expect(changesPerS(o, 'inTune')).toBe(0); expect(o.filter(f => f.t > 0.8).every(f => f.inTune && Math.abs(f.read) <= 15)).toBe(true)
  })
  test.each([[8], [-8], [12], [-12]])('%s ¢ with ±6 ¢ vibrato at the default ±10: green stays on inside and off outside, never flickers', c => {
    const o = frames(t => c + 6 * Math.sin(2 * Math.PI * 5.5 * t), 4, 10), late = o.filter(f => f.t > 0.8)
    expect(changesPerS(o, 'inTune')).toBe(0); expect(late.every(f => f.inTune === Math.abs(c) <= 10 && f.inTune === Math.abs(f.read) <= 10)).toBe(true)
  })
  test('turning a peg from −30 to 0 ¢ over 2 s: the number follows within 7 ¢ and reads 0 within 0.45 s after stopping', () => {
    const o = frames(t => t < 0.5 ? -30 : t < 2.5 ? -30 + 15 * (t - 0.5) : 0, 4)
    for (const f of o) if (f.t > 0.9 && f.t < 2.5) expect(Math.abs(f.read - (-30 + 15 * (f.t - 0.5)))).toBeLessThanOrEqual(7)
    const zero = o.find(f => f.t >= 2.5 && f.read === 0); expect(zero).toBeDefined(); expect(zero!.t - 2.5).toBeLessThan(0.45)
    expect(o.filter(f => f.t > 3.2).every(f => f.read === 0 && f.inTune)).toBe(true)
  })
  test('a 25 ¢ step: the number is within 3 ¢ when the line arrives (0.4 s) and exact within 0.75 s', () => {
    const o = frames(t => t < 1.5 ? 0 : 25, 3)
    const near = o.find(f => f.t >= 1.5 && Math.abs(f.read - 25) <= 3), exact = o.find(f => f.t >= 1.5 && Math.abs(f.read - 25) <= 1)
    expect(near!.t - 1.5).toBeLessThan(0.45); expect(exact!.t - 1.5).toBeLessThan(0.75)
  })
})

describe('scales: a slurred semitone step reads the new note\'s own offset', () => {
  // 다장조의 미→파·시→도·도→시 반음 슬러. 이전 음이 방 울림·남겨 둔 손가락으로 −6~−10 dB 에서 0.12 s 에 걸쳐 사라진다.
  // 이전 음에서 이어진 평활·평균이 남으면 새 음 숫자가 0.2 s 뒤에도 이전 음 쪽으로 3~13 ¢ 끌려 있다(8분음표 80 이면 음 끝까지)
  const sr = 48000, N = 4096, HOP = 1024
  function slur(m0: number, c0: number, m1: number, c1: number, ring: number) {
    const t0 = 0.6, n = Math.round((t0 + 0.375) * sr), x = new Float32Array(n)
    const f = (m: number, c: number) => 440 * Math.pow(2, (m - 69 + c / 100) / 12)
    let ph = 0, ph0 = 0
    for (let i = 0; i < n; i++) {
      const t = i / sr, g = t < t0 ? 0 : Math.min(1, (t - t0) / 0.01)
      ph += 2 * Math.PI * (f(m0, c0) + (f(m1, c1) - f(m0, c0)) * g) / sr; ph0 += 2 * Math.PI * f(m0, c0) / sr
      let s = 0, r = 0; for (let h = 1; h <= 10; h++) { s += Math.sin(ph * h + h) / h; r += Math.sin(ph0 * h + 2 * h) / h }
      x[i] = 0.12 * Math.min(1, t / 0.06) * s + (t >= t0 ? 0.12 * ring * Math.exp(-(t - t0) / 0.12) * r : 0)
    }
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 440, tolCents: 10 })
    const out: Array<{ t: number; midi: number; read: number }> = []
    for (let e = N; e <= n; e += HOP) { const fr = a.process(x.subarray(e - N, e)); out.push({ t: e / sr - t0, midi: fr.midi, read: fr.readCents }) }
    return out
  }
  test.each([[64, 14, 65, -11, .5], [71, 8, 72, -2, .5], [76, 0, 77, -15, .5], [84, 2, 83, 5, .3]])('%s %s ¢ → %s %s ¢ (ring %s): from 0.2 s after the change the number is the new note\'s within 2 ¢', (m0, c0, m1, c1, ring) => {
    const late = slur(m0, c0, m1, c1, ring).filter(f => f.t >= 0.2)
    expect(late.length).toBeGreaterThan(5)
    for (const f of late) { expect(f.midi).toBe(m1); expect(Math.abs(f.read - c1), `t=${f.t.toFixed(3)} read=${f.read}`).toBeLessThanOrEqual(2) }
  })
})
