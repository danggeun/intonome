import { describe, test, expect } from 'vitest'
import { createAnalyzer } from './analyzer.ts'
import { keepInTrace, buildSegments } from '../trace.ts'

const sr = 44100, N = 4096
const tone = (f: number, harm = 4) => Float32Array.from({ length: N }, (_, i) => { let s = 0; for (let h = 1; h <= harm; h++) s += Math.sin(2 * Math.PI * f * h * i / sr) / h; return 0.3 * s })

/** 같은 창을 여러 번 넣어 트래커가 음이름을 확정하게 한 뒤 마지막 프레임 */
function settle(refHz: number, playedHz: number) {
  const an = createAnalyzer({ sampleRate: sr, windowSize: N }); an.setSettings({ refHz, tolCents: 15, rmsMin: .008 })
  let f = an.process(tone(playedHz)); for (let i = 0; i < 12; i++) f = an.process(tone(playedHz)); return f
}

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
    const cents: Array<number | null> = [], midi: Array<number | null> = []
    for (let end = N; end <= x.length; end += HOP) {
      const f = a.process(x.subarray(end - N, end)); if (end / sr < 0.6) continue // 첫 활의 음이름이 확정된 뒤부터
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

describe('nothing is played — the tuner shows nothing', () => {
  // 피드백(2026-10-24): 바깥에서 그냥 켜 두면 주변 소리에 음이 틱틱 떴다. 말소리 음절·새소리·딸깍은 한두 프레임만 주기적이거나 피치가 미끄러진다 —
  // 같은 음으로 3 프레임 이어질 때만 새로 띄운다
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
  test('a note that starts over the same ambience still shows within 150 ms', () => {
    const x = ambient(1, 6), f0 = 442 * Math.pow(2, -14 / 12); let ph = 0 // G3
    for (let i = Math.round(3 * sr); i < x.length; i++) { const t = i / sr - 3; ph += 2 * Math.PI * f0 * 2 ** (5 * Math.sin(2 * Math.PI * 5.3 * t) / 1200) / sr; let s = 0; for (let h = 1; h <= 12; h++) s += Math.sin(ph * h + h) / h; x[i] = x[i]! + 0.1 * s * Math.min(1, t / 0.08) }
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 442, tolCents: 15 })
    let first = -1
    for (let end = N; end <= x.length; end += HOP) { const f = a.process(x.subarray(end - N, end)); if (f.hz > 0 && first < 0) { first = end / sr - 3; expect(f.midi).toBe(55) } }
    expect(first).toBeGreaterThan(0); expect(first).toBeLessThan(0.15)
  })
})
