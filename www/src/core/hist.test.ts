import { describe, test, expect } from 'vitest'
import { histLenFor, rowsShown } from './hist.ts'

describe('rowsShown — a short trace area shows only the latest frames instead of squashing them', () => {
  const n = histLenFor(44100, 4) // 172 frames
  test('the usual phone sizes draw the whole window', () => {
    expect(rowsShown(n, 496)).toBe(n) // 390×844 collapsed
    expect(rowsShown(n, 276)).toBe(n) // 390×844 expanded
  })
  test('a small iPhone with the metronome expanded (~100 px) draws the last 80 frames, about 1.9 s', () => {
    expect(rowsShown(n, 100)).toBe(80)
  })
  test('never fewer than two frames (a line needs two points)', () => expect(rowsShown(n, 0)).toBe(2))
})

describe('histLenFor', () => {
  test('the window is the same number of seconds at any sample rate', () => {
    for (const sr of [44100, 48000, 32000, 96000]) {
      const n = histLenFor(sr, 4.0)
      expect(n * 1024 / sr).toBeCloseTo(4.0, 1)
    }
  })
  test('how many seconds v2.0.1’s 360 frames really were (regression record)', () => {
    expect(360 * 1024 / 48000).toBeCloseTo(7.68, 2)
    expect(360 * 1024 / 44100).toBeCloseTo(8.36, 2)
  })
  test('a 4-second window is 188 frames at 48 kHz — half the old 360 (density drops too)', () => {
    expect(histLenFor(48000, 4.0)).toBe(188)
    expect(histLenFor(44100, 4.0)).toBe(172)
  })
  test('odd sample rates fall back to 44100, minimum 8', () => {
    expect(histLenFor(0, 4)).toBe(histLenFor(44100, 4))
    expect(histLenFor(NaN, 4)).toBe(histLenFor(44100, 4))
    expect(histLenFor(48000, 0.0001)).toBe(8)
  })
})
