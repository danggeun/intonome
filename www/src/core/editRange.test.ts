import { describe, test, expect } from 'vitest'
import { viewRange, frac, timeAt, zoomWindow, clampA, clampB, loopStart, clampSpeed, speedLabel, nextPreset } from './editRange.ts'

describe('editor track window', () => {
  test('whole recording unless zoomed; unknown length maps to 0..1', () => {
    expect(viewRange(null, 60)).toEqual({ t0: 0, t1: 60 })
    expect(viewRange(null, 0)).toEqual({ t0: 0, t1: 1 })
    expect(viewRange({ t0: 5, t1: 5 }, 60)).toEqual({ t0: 0, t1: 60 })
  })
  test('time ↔ position stick to the edges outside the window', () => {
    const r = { t0: 10, t1: 20 }
    expect(frac(15, r)).toBe(0.5); expect(frac(5, r)).toBe(0); expect(frac(25, r)).toBe(1)
    expect(timeAt(0.25, r)).toBe(12.5); expect(timeAt(-1, r)).toBe(10)
  })
  test('zoom window is A − 2 s … B + 2 s inside the recording', () => {
    expect(zoomWindow(1, 30, 40)).toEqual({ t0: 0, t1: 32 })
    expect(zoomWindow(10, 39, 40)).toEqual({ t0: 8, t1: 40 })
    expect(zoomWindow(null, 30, 40)).toBe(null)
  })
})

describe('A and B points', () => {
  test('A stays at least 0.1 s before B, B at least 0.1 s after A, both inside the recording', () => {
    expect(clampA(9.95, 10, 60)).toBeCloseTo(9.9)
    expect(clampA(-1, null, 60)).toBe(0)
    expect(clampA(70, null, 60)).toBe(60)
    expect(clampB(5.02, 5, 60)).toBeCloseTo(5.1)
    expect(clampB(80, 5, 60)).toBe(60)
  })
  test('loop start: from A, or 1 s before A but never below 0', () => {
    expect(loopStart(5, 1)).toBe(5); expect(loopStart(5, 2)).toBe(4); expect(loopStart(0.4, 2)).toBe(0); expect(loopStart(null, 1)).toBe(0)
  })
})

describe('playback speed', () => {
  test('0.01 steps between 0.5 and 1.5', () => {
    expect(clampSpeed(0.756)).toBe(0.76); expect(clampSpeed(0.2)).toBe(0.5); expect(clampSpeed(3)).toBe(1.5)
  })
  test('label keeps one decimal when it can', () => {
    expect(speedLabel(1)).toBe('1.0×'); expect(speedLabel(0.5)).toBe('0.5×'); expect(speedLabel(0.85)).toBe('0.85×')
  })
  test('tap cycles 1.0 → 0.5 → 0.7 → 0.85 → 1.0; a slider value goes to 1.0', () => {
    expect([1, 0.5, 0.7, 0.85].map(nextPreset)).toEqual([0.5, 0.7, 0.85, 1])
    expect(nextPreset(0.75)).toBe(1)
  })
})
