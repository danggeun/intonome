import { describe, test, expect } from 'vitest'
import { createYinFast } from './yinFast.ts'
import { yin as yinDirect } from '../yin.ts'

const sr = 44100, N = 4096
const tone = (f: number, harm = 1) => Float32Array.from({ length: N }, (_, i) => { let s = 0; for (let h = 1; h <= harm; h++) s += Math.sin(2 * Math.PI * f * h * i / sr) / h; return 0.4 * s })

describe('yinFast', () => {
  const y = createYinFast(N, { hzMin: 40, hzMax: 4200 })
  test('matches direct YIN on sines and harmonic tones (< 0.05 cents)', () => {
    for (const [f, h] of [[440, 1], [220, 1], [65.41, 6], [1318.5, 1], [196, 8], [41.2, 5]] as const) {
      const a = y.process(tone(f, h), sr).hz, b = yinDirect(tone(f, h), sr)
      expect(b).toBeGreaterThan(0)
      expect(Math.abs(1200 * Math.log2(a / b))).toBeLessThan(0.05)
      expect(Math.abs(1200 * Math.log2(a / f))).toBeLessThan(3)
    }
  })
  test('confidence: sine ≈ 1, noise low, silence none', () => {
    expect(y.process(tone(440), sr).conf).toBeGreaterThan(0.95)
    let seed = 7; const noise = Float32Array.from({ length: N }, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x80000000 - 1 })
    const r = y.process(noise, sr); expect(r.hz === -1 || r.conf < 0.5).toBe(true)
    expect(y.process(new Float32Array(N), sr).hz).toBe(-1)
  })
  test('in low-frequency noise the period stays at A4 where direct YIN falls octaves below', () => {
    // 잡음이 섞이면 A4 의 골짜기가 임계(0.10)를 못 넘고 전역 최소가 긴 배수 주기에 떨어진다. 직접 YIN(옛 규칙)은 2~4 옥타브 아래를 낸다
    let fixed = 0, oldWrong = 0
    for (const seed0 of [2, 3, 4, 6, 7]) {
      let seed = seed0 * 977; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x80000000 - 1 }
      const mine = tone(440, 6), x = new Float32Array(N); let lp = 0
      for (let i = 0; i < N; i++) { lp = 0.9 * lp + 0.1 * rnd(); x[i] = mine[i]! + 0.3 * (rnd() * 0.5 + lp * 3) }
      const a = y.process(x, sr).hz, b = yinDirect(x, sr)
      if (Math.abs(1200 * Math.log2(a / 440)) < 20) fixed++
      if (b > 0 && Math.abs(1200 * Math.log2(b / 440)) > 1100) oldWrong++
    }
    expect(fixed).toBe(5); expect(oldWrong).toBe(5)
  })
  test('harmonic tones keep their period: the shorter dips at T/2, T/3 are not clear enough to win', () => {
    for (const [f, h] of [[196, 8], [293.66, 6], [440, 6], [65.41, 6]] as const) {
      const r = y.process(tone(f, h), sr); expect(Math.abs(1200 * Math.log2(r.hz / f))).toBeLessThan(3)
    }
  })
  test('hzMin=40 reaches bass E1 (41.2 Hz)', () => { const r = y.process(tone(41.2, 6), sr); expect(Math.abs(1200 * Math.log2(r.hz / 41.2))).toBeLessThan(5) })
  test('is much faster than direct YIN', () => {
    const b = tone(440, 6); const t0 = performance.now(); for (let i = 0; i < 20; i++) y.process(b, sr); const fast = (performance.now() - t0) / 20
    const t1 = performance.now(); for (let i = 0; i < 5; i++) yinDirect(b, sr); const slow = (performance.now() - t1) / 5
    expect(fast * 2).toBeLessThan(slow)
  })
})
