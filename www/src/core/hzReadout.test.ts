import { describe, test, expect } from 'vitest'
import { fmtHz, calmHz } from './hzReadout.ts'
import { createAnalyzer } from './pitch/analyzer.ts'

describe('Hz readout — fixed width', () => {
  test('2-, 3- and 4-digit values have the same length (Hz doesn’t move)', () => {
    const rows = [fmtHz(65.4), fmtHz(196), fmtHz(442.31), fmtHz(1046.5)]
    expect(rows).toEqual(['  65.4 Hz', ' 196.0 Hz', ' 442.3 Hz', '1046.5 Hz'])
    expect(new Set(rows.map(r => r.length)).size).toBe(1)
  })
  test('silence and invalid values give an empty string', () => {
    expect(fmtHz(-1)).toBe(''); expect(fmtHz(0)).toBe(''); expect(fmtHz(NaN)).toBe(''); expect(fmtHz(calmHz(-1, 0, 0))).toBe('')
  })
})

describe('Hz readout — says the same pitch as the cents number', () => {
  test('A = 442, A4 read as −8 ¢: 440.0 Hz, whatever the frame’s own value', () => {
    for (const c of [-14.2, -8, -6.4, -1.9]) expect(fmtHz(calmHz(442 * 2 ** (c / 1200), c, -8))).toBe(' 440.0 Hz')
  })
  test('C2 −8 ¢ at A = 442 keeps two digits', () => {
    const c2 = 442 * 2 ** (-33 / 12); expect(fmtHz(calmHz(c2 * 2 ** (-3 / 1200), -3, -8))).toBe('  65.4 Hz')
  })
  test.each([[4.5], [5.5], [6.5]])('vibrato ±15 ¢ at %s Hz: the Hz text changes only when the cents number does (0 times a second at 5.5 Hz)', rate => {
    // 2.5.6: 지수 평활 + 100 ms 갱신이라 비브라토 동안 소수점이 초당 약 7 번 바뀌었다(바로 옆 센트 숫자는 그대로)
    const sr = 48000, N = 4096, HOP = 1024, sec = 4, x = new Float32Array(sec * sr); let ph = 0
    for (let i = 0; i < x.length; i++) { const t = i / sr; ph += 2 * Math.PI * 440 * 2 ** (15 * Math.sin(2 * Math.PI * rate * t) / 1200) / sr; let s = 0; for (let h = 1; h <= 10; h++) s += Math.sin(ph * h + h) / h; x[i] = 0.1 * s * Math.min(1, t / 0.08) }
    const a = createAnalyzer({ sampleRate: sr, windowSize: N, hzMin: 40, hzMax: 4200 }); a.setSettings({ rmsMin: .005, smoothing: .2, refHz: 442, tolCents: 10 })
    let hzCh = 0, cCh = 0, prevHz = '', prevC = NaN, frames = 0
    for (let end = N; end <= x.length; end += HOP) {
      const f = a.process(x.subarray(end - N, end)); if (f.hz <= 0 || end / sr < 1) continue
      const h = fmtHz(calmHz(f.hz, f.cents, f.readCents)); frames++
      if (prevHz && h !== prevHz) hzCh++; if (!isNaN(prevC) && f.readCents !== prevC) cCh++
      prevHz = h; prevC = f.readCents
      expect(h).toBe(fmtHz(442 * 2 ** (f.readCents / 1200))) // 숫자가 말하는 높이 그대로
    }
    expect(frames).toBeGreaterThan(100); expect(hzCh).toBeLessThanOrEqual(cCh)
    if (rate === 5.5) expect(hzCh).toBe(0)
  })
})
