import { describe, test, expect } from 'vitest'
import { droneHz, playAHz, createToneFilter, rms, onlyTone, TONE_SETTLE_S, TONE_GAIN } from './drone.ts'
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

/** 워커와 같은 흐름: 청크마다 앱 음을 잘라내고, 창마다 '앱 음뿐' 판정 → 분석기. 자리 잡은 뒤의 프레임을 모은다 */
function frames(mic: Float32Array, toneF: number) {
  const y = new Float32Array(mic.length), rem = new Float32Array(mic.length), filter = createToneFilter(sr, toneF)
  const an = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); an.setSettings({ refHz: 442, tolCents: 15, rmsMin: .005, smoothing: .14 })
  const bare = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); bare.setSettings({ refHz: 442, tolCents: 15, rmsMin: .005, smoothing: .14 })
  const silent = new Float32Array(N), out = []
  for (let p = 0; p + HOP <= mic.length; p += HOP) {
    filter.process(mic.subarray(p, p + HOP), y.subarray(p, p + HOP), rem.subarray(p, p + HOP))
    const end = p + HOP; if (end < N) continue
    const win = y.subarray(end - N, end), gate = onlyTone(rms(win), rms(rem.subarray(end - N, end)))
    const frame = an.process(gate ? silent : win), raw = bare.process(win) // raw: 판정 없이 잘라낸 소리만 분석
    if ((end - N) / sr >= TONE_SETTLE_S) out.push({ frame, raw, gate })
  }
  return out
}

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
