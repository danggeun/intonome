import { describe, test, expect } from 'vitest'
import { droneHz, playAHz, createToneFilter, createToneProbe, rms, onlyTone, TONE_SETTLE_S, TONE_GAIN } from './drone.ts'
import { createAnalyzer } from './pitch/analyzer.ts'

const sr = 48000, N = 4096, HOP = 1024
const hzOf = (semisFromA: number, ref = 442) => ref * Math.pow(2, semisFromA / 12)
/** 소리 = 사인 성분 목록 [주파수, 진폭, 위상] */
type Sig = Array<[number, number, number]>

/** 앱이 내는 음: 브라우저 삼각파처럼 홀수 배음 1/n² (10 kHz 까지, 그 위는 −60 dB 아래) */
const tone = (f: number, amp = TONE_GAIN): Sig => {
  const hs: Sig = []
  for (let n = 1; n * f < 10000; n += 2) hs.push([n * f, amp * (8 / Math.PI ** 2) * (((n - 1) / 2) % 2 ? -1 : 1) / (n * n), 0])
  return hs
}
/** 현악기 비슷한 소리: 기본음 + 배음 8개(1/h) */
const string = (f: number, amp = 0.3): Sig => Array.from({ length: 8 }, (_, h) => [f * (h + 1), amp / (h + 1), 0] as [number, number, number])
const mix = (...fs: Sig[]): Sig => fs.flat()
/** 성분마다 회전(복소수 곱)으로 더한다: Math.sin 을 샘플마다 부르지 않는다 */
const render = (f: Sig, seconds: number) => {
  const x = new Float32Array(Math.round(seconds * sr))
  for (const [hz, a, ph] of f) {
    const w = 2 * Math.PI * hz / sr, cw = Math.cos(w), sw = Math.sin(w)
    let re = Math.cos(ph), im = Math.sin(ph)
    for (let i = 0; i < x.length; i++) { x[i] = x[i]! + a * im; const r = re * cw - im * sw; im = re * sw + im * cw; re = r }
  }
  return x
}
/** 폰 스피커의 찌그러짐: f 의 정수배 성분만 생긴다(아날로그라 접힘이 없다). level 1 = 2배음 30 %, 3배음 20 %, 4배음 12 %, 5배음 8 %, 그 위 8 %·(5/k)². 실제 폰보다 심하게 */
const distortion = (f: number, level: number, amp = TONE_GAIN * 8 / Math.PI ** 2): Sig => {
  const hs: Sig = []
  for (let k = 2; k * f < 20000; k++) hs.push([k * f, amp * level * (k === 2 ? .3 : k === 3 ? .2 : k === 4 ? .12 : .08 * (5 / k) ** 2), (k * 2.39996) % (2 * Math.PI)])
  return hs
}
/** 방: 벽에서 돌아오는 소리 세 갈래(7 · 19 · 41 ms) + 잡음(시드 고정) */
function room(x: Float32Array, noiseRms: number): Float32Array {
  const z = x.slice()
  for (const [t, g] of [[0.007, 0.5], [0.019, 0.3], [0.041, 0.2]] as const) { const k = Math.round(t * sr); for (let i = k; i < z.length; i++) z[i] = z[i]! + g * x[i - k]! }
  let s = 12345; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296 - 0.5 }
  for (let i = 0; i < z.length; i++) z[i] = z[i]! + noiseRms * Math.sqrt(12) * rnd()
  return z
}
/** 앱 음이 스피커(찌그러짐 level)와 방을 지나 마이크에 들어온 소리 */
const appAtMic = (f: number, level: number, noiseRms: number, seconds: number) => room(render(mix(tone(f), distortion(f, level)), seconds), noiseRms)

/** 워커와 같은 흐름: 청크마다 앱 음을 잘라내고, 창마다 '앱 음이 마이크에 들리는가'(probe) → 들리면 '앱 음뿐' 판정, 안 들리면(이어폰) 원래 소리 → 분석기.
 * probe:false 는 2.5.3 까지의 규칙(늘 잘라낸다). recheckAt: 그 시각에 소리 장치가 바뀌었다는 알림. 자리 잡은 뒤의 프레임을 모은다 */
function frames(mic: Float32Array, toneF: number, opt: { probe?: boolean; rmsMin?: number; recheckAt?: number } = {}) {
  const y = new Float32Array(mic.length), rem = new Float32Array(mic.length), filter = createToneFilter(sr, toneF), probe = createToneProbe(sr, toneF, N)
  const settings = { refHz: 442, tolCents: 15, rmsMin: opt.rmsMin ?? .005, smoothing: .14 }
  const an = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); an.setSettings(settings)
  const bare = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); bare.setSettings(settings)
  const silent = new Float32Array(N), out = []
  let rechecked = false, holdUntil = TONE_SETTLE_S
  for (let p = 0; p + HOP <= mic.length; p += HOP) {
    filter.process(mic.subarray(p, p + HOP), y.subarray(p, p + HOP), rem.subarray(p, p + HOP))
    const end = p + HOP; if (end < N) continue
    const t = end / sr
    if (opt.recheckAt !== undefined && !rechecked && t >= opt.recheckAt) { probe.recheck(); rechecked = true; holdUntil = t + TONE_SETTLE_S; an.reset() } // 워커의 toneRecheck
    const win = y.subarray(end - N, end), gate = onlyTone(rms(win), rms(rem.subarray(end - N, end)))
    // 워커처럼 필터가 자리 잡기 전엔 무음으로 — 자리 잡기 전 소리에서 잡힌 음이 유지 시간(releaseFrames) 동안 남아 뒤 프레임을 물들이지 않게. raw: 판정 없이 잘라낸 소리만 분석
    const settled = (end - N) / sr >= holdUntil
    const was = probe.bypass, bypass = (opt.probe ?? true) && settled && probe.frame(mic.subarray(end - N, end), end - N, settings.rmsMin)
    if (was && !bypass) an.reset()
    const frame = an.process(bypass ? mic.subarray(end - N, end) : gate || !settled ? silent : win), raw = bare.process(settled ? win : silent)
    if (settled) out.push({ t, frame, raw, gate, bypass })
  }
  return out
}
/** 활로 켜는 소리: 배음 8 개, 느린 음정 흔들림(±0.4 ¢), 빠른 세기 흔들림 3 %, 활 하나 안에서 ±15 % 부풀기, 어택 80 ms · 놓으면 0.15 s 에 사라짐. 시드 고정 */
function bowed(f: number, seconds: number, o: { cents?: number; amp?: number; from?: number; to?: number; seed?: number } = {}): Float32Array {
  const x = new Float32Array(Math.round(seconds * sr)), PROF = [1, .7, .55, .45, .5, .3, .25, .2]
  let s = o.seed ?? 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5 }
  const ph0 = PROF.map(() => rnd() * 2 * Math.PI), from = o.from ?? 0, to = o.to ?? seconds, amp = o.amp ?? 0.05
  const aw = Math.exp(-1 / (0.3 * sr)), sw = 0.4 * Math.sqrt(1 - aw * aw) * 3.46, aj = Math.exp(-1 / (0.05 * sr)), sj = 0.03 * Math.sqrt(1 - aj * aj) * 3.46
  let ph = 0, wan = 0, jit = 0
  for (let i = Math.round(from * sr); i < x.length; i++) {
    const u = i / sr - from, len = to - from
    if (u > len + 1) break
    wan = aw * wan + sw * rnd(); jit = aj * jit + sj * rnd()
    ph += 2 * Math.PI * f * Math.pow(2, ((o.cents ?? 0) + wan) / 1200) / sr
    const env = (u < len ? Math.min(1, u / 0.08) : Math.exp(-(u - len) / 0.15)) * (1 + 0.15 * Math.sin(2 * Math.PI * u / Math.max(len, 1))) * (1 + jit)
    let v = 0; for (let h = 0; h < PROF.length; h++) v += PROF[h]! * Math.sin((h + 1) * ph + ph0[h]!)
    x[i] = amp * env * v
  }
  return x
}
const add = (...xs: Float32Array[]) => { const y = new Float32Array(Math.max(...xs.map(x => x.length))); for (const x of xs) for (let i = 0; i < x.length; i++) y[i] = y[i]! + x[i]!; return y }

describe('app tones: pitch', () => {
  test('drone in octave 4 at the reference pitch; Play A follows the octave setting', () => {
    expect(droneHz(9, 442)).toBeCloseTo(442, 6)
    expect(droneHz(0, 440)).toBeCloseTo(261.63, 2)
    expect(playAHz(442, 4)).toBe(442); expect(playAHz(442, 3)).toBe(221); expect(playAHz(440, 2)).toBe(110)
  })
})

describe('app tones: the filter', () => {
  const gainAt = (toneF: number, testF: number) => {
    const x = render([[testF, 1, 0]], TONE_SETTLE_S + 0.2), y = new Float32Array(x.length), r = new Float32Array(x.length)
    createToneFilter(sr, toneF).process(x, y, r)
    return 20 * Math.log10(rms(y.subarray(x.length - N)) / rms(x.subarray(x.length - N)))
  }
  test('removes the tone and every whole multiple of it by at least 40 dB once settled', () => {
    for (const f of [110, 221, droneHz(0, 440), droneHz(5, 442), 442, droneHz(11, 442)]) {
      const parts = createToneFilter(sr, f).partials
      expect(parts.length).toBeGreaterThanOrEqual(16)
      for (const k of [1, 2, 3, 4, 5, 7, 10, parts.length]) expect(gainAt(f, k * f), `${f.toFixed(1)} Hz × ${k}`).toBeLessThan(-40)
    }
  })
  test('the semitones next to the tone pass almost untouched (< 0.5 dB)', () => {
    for (const f of [droneHz(0, 440), droneHz(2, 442), 442]) for (const s of [-1, 1]) expect(gainAt(f, f * Math.pow(2, s / 12))).toBeGreaterThan(-0.5)
  })
})

describe('app tones alone never show on the tuner', () => {
  // 드론 12음 × 기준음 440/442, A 듣기 A4/A3/A2 × 440/442. 찌그러짐 없음 · 심함 · 매우 심함(+ 큰 잡음)
  const cases: Array<[string, number]> = []
  for (const ref of [440, 442]) {
    for (let pc = 0; pc < 12; pc++) cases.push([`drone ${pc} @${ref}`, droneHz(pc, ref)])
    for (const o of [4, 3, 2]) cases.push([`Play A${o} @${ref}`, playAHz(ref, o)])
  }
  test.each(cases)('%s', (_, f) => {
    for (const [level, noise] of [[0, 0.001], [0.5, 0.001], [1, 0.02]] as const) {
      const fs = frames(appAtMic(f, level, noise, TONE_SETTLE_S + 0.8), f)
      expect(fs.length).toBeGreaterThan(20)
      for (const { frame, raw, gate } of fs) {
        expect(frame.hz, 'tuner shows --').toBe(-1)
        expect(frame.playing).toBe(false)
        expect(gate || raw.hz === -1, 'what is left after the filter is not read as a note either').toBe(true)
      }
    }
  })
})

describe('the tuner reads the player over an app tone', () => {
  const D4 = droneHz(2, 442)
  const read = (playF: number, toneF: number, drive: number) => {
    const player = render(string(playF), 1.4), app = appAtMic(toneF, drive, 0.001, 1.4)
    const fs = frames(player.map((v, i) => v + app[i]!), toneF)
    return fs[fs.length - 1]!
  }
  test.each([
    ['레3 under a 레4 drone (octave below)', hzOf(-19), 50],
    ['라4 over a 레4 drone (fifth)', hzOf(0), 69],
    ['솔4 over a 레4 drone (fourth)', hzOf(-2), 67],
    ['파♯4 over a 레4 drone (major third)', hzOf(-3), 66],
    ['미4 over a 레4 drone (second)', hzOf(-5), 64],
    ['시4 over a 레4 drone (sixth)', hzOf(2), 71],
    ['도5 over a 레4 drone (minor seventh)', hzOf(3), 72],
    ['솔3 under a 레4 drone (fifth below)', hzOf(-14), 55],
  ])('%s', (_, playF, midi) => {
    for (const drive of [0, 1]) {
      const { frame, gate } = read(playF, D4, drive)
      expect(frame.midi, `drive ${drive}`).toBe(midi)
      expect(Math.abs(frame.cents)).toBeLessThanOrEqual(3)
      expect(gate).toBe(false)
    }
  })
  // 연주 음의 성분이 전부 앱 음의 정수배와 겹치는 자리(같은 음 · 옥타브 · 12도 · 두 옥타브): 정확히 맞으면 함께 잘려 '--', 몇 센트만 벗어나도 읽는다
  test.each([['unison', 1, 62], ['octave', 2, 74], ['two octaves', 4, 86]] as const)('%s over a 레4 drone: exactly in tune shows --, 5 ¢ off reads', (_, mult, midi) => {
    expect(read(D4 * mult, D4, 1).gate).toBe(true)
    for (const c of [5, -5, 20]) { const { frame } = read(D4 * mult * Math.pow(2, c / 1200), D4, 1); expect(frame.midi).toBe(midi); expect(Math.abs(frame.cents - c)).toBeLessThanOrEqual(2) }
  })
  test('Play A: the other strings read while A sounds (레4 · 솔3 · 미5 over A4)', () => {
    for (const [f, midi] of [[hzOf(-7), 62], [hzOf(-14), 55], [hzOf(7), 76]] as const) expect(read(f, 442, 1).frame.midi).toBe(midi)
  })
})

// 이어폰: 앱 음이 마이크에 들어가지 않는다. 2.5.3 까지는 그래도 잘라내서 같은 음(옥타브)을 맞게 켜면 '--' 였다
describe('the app tone not reaching the mic (earphones): nothing to cut, so the same note reads', () => {
  const quietRoom = (sec: number) => room(new Float32Array(Math.round(sec * sr)), 0.0003)
  const shownAfter = (fs: ReturnType<typeof frames>, t0: number, midi: number) => { const a = fs.filter(f => f.t > t0); return { pct: a.filter(f => f.frame.hz > 0 && f.frame.midi === midi).length / a.length, reads: a.filter(f => f.frame.hz > 0).map(f => f.frame.readCents) } }
  test.each([-10, -3, 0, 3, 10])('Play A with earphones, A string at %s ¢: reads within 1 ¢ (2.5.3 hid it in tune)', (c) => {
    const mic = add(quietRoom(4), bowed(442, 4, { cents: c, from: 0.8, to: 4, seed: 20 + c }))
    const now = shownAfter(frames(mic, 442), 1.5, 69), before = shownAfter(frames(mic, 442, { probe: false }), 1.5, 69)
    expect(now.pct).toBeGreaterThan(0.95)
    for (const r of now.reads) expect(Math.abs(r - c)).toBeLessThanOrEqual(1)
    if (c === 0) expect(before.pct, '2.5.3').toBeLessThan(0.2)
  }, 30000)
  test('drone 레4 with earphones: 레4 and 레5 read (2.5.3 hid both)', () => {
    const D4 = droneHz(2, 442)
    for (const [f, midi] of [[D4, 62], [D4 * 2, 74]] as const) {
      const mic = add(quietRoom(3.5), bowed(f, 3.5, { from: 0.8, to: 3.5, seed: midi }))
      expect(shownAfter(frames(mic, D4), 1.5, midi).pct).toBeGreaterThan(0.95)
      expect(shownAfter(frames(mic, D4, { probe: false }), 1.5, midi).pct, '2.5.3').toBeLessThan(0.2)
    }
  }, 30000)
  test('through the speaker nothing changes: every frame equals the 2.5.3 rule and the tone is always cut', () => {
    for (const c of [0, 5]) {
      const mic = add(appAtMic(442, 0.5, 0.001, 3.5), bowed(442, 3.5, { cents: c, from: 0.8, to: 3.5, amp: 0.1, seed: 3 }))
      const now = frames(mic, 442), before = frames(mic, 442, { probe: false })
      expect(now.some(f => f.bypass)).toBe(false)
      expect(now.map(f => `${f.frame.midi}|${f.frame.readCents}`)).toEqual(before.map(f => `${f.frame.midi}|${f.frame.readCents}`))
    }
  }, 30000)
  test('earphones pulled out with the tone on: the tone at the mic is recognised and gone from the screen within 0.25 s', () => {
    const sec = 6, mic = quietRoom(sec), tone = appAtMic(442, 0.5, 0, sec), at = Math.round(3 * sr)
    for (let i = at; i < mic.length; i++) mic[i] = mic[i]! + tone[i]! * Math.min(1, (i - at) / (0.03 * sr))
    for (const recheckAt of [undefined, 3.0]) { // 소리 장치 알림이 없는 기기 · 있는 기기
      const fs = frames(mic, 442, { recheckAt })
      expect(fs.filter(f => f.t > 0.7 && f.t < 3).every(f => f.bypass), 'earphones: not cut').toBe(true)
      expect(fs.filter(f => f.t > 3.25).some(f => f.bypass || f.frame.hz > 0), `after (recheck ${recheckAt})`).toBe(false)
      expect(fs.filter(f => f.t > 3 && f.frame.hz > 0).length, `flash frames (recheck ${recheckAt})`).toBeLessThanOrEqual(recheckAt === undefined ? 8 : 0)
    }
  }, 30000)
  test('a faint leak counts as heard only above a tenth of the sensitivity gate (it follows the setting)', () => {
    const leak = render(tone(442, 5.2e-4), 3), mic = add(quietRoom(3), leak) // 앱 음 성분 rms ≈ 3e-4
    expect(frames(mic, 442, { rmsMin: .005 }).at(-1)!.bypass, 'normal: 5e-4 gate/10 → not heard').toBe(true)
    expect(frames(mic, 442, { rmsMin: .002 }).at(-1)!.bypass, 'high: 2e-4 → heard, cut').toBe(false)
    expect(frames(mic, 442, { rmsMin: .005 }).every(f => f.frame.hz === -1), 'the faint leak itself never shows').toBe(true)
  }, 30000)
  test('already playing the same note when Play A starts: that stroke stays as in 2.5.3, the next one after a pause reads', () => {
    const mic = add(quietRoom(6.5), bowed(442, 6.5, { from: 0, to: 2.5, seed: 5 }), bowed(442, 6.5, { cents: 2, from: 4, to: 6.5, seed: 6 }))
    const fs = frames(mic, 442)
    expect(fs.filter(f => f.t < 2.4).some(f => f.bypass), 'not judged while the note sounds').toBe(false)
    expect(shownAfter(fs, 4.6, 69).pct).toBeGreaterThan(0.95)
  }, 30000)
})
