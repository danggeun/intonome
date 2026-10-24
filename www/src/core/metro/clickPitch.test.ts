import { describe, test, expect } from 'vitest'
import { CLICK_BASE_HZ, clickHz, isClickPitch, CLICK_REJECT_CENTS } from './clickPitch.ts'

const centsToNearestNote = (hz: number, ref: number) => { const s = 12 * Math.log2(hz / ref); return 100 * (s - Math.round(s)) }

describe('metronome click pitches sit exactly between two notes', () => {
  test('for every reference from 410 to 466 Hz, each click is 50 cents from the nearest note and within a semitone of its base', () => {
    for (let ref = 410; ref <= 466; ref += 0.5) for (const base of Object.values(CLICK_BASE_HZ)) {
      const f = clickHz(base, ref)
      expect(Math.abs(Math.abs(centsToNearestNote(f, ref)) - 50)).toBeLessThan(1e-6)
      expect(Math.abs(1200 * Math.log2(f / base))).toBeLessThanOrEqual(50 + 1e-6)
    }
  })
  test('at A = 440 the clicks are 1811.6, 1077.2 and 761.7 Hz', () => {
    expect(clickHz(1800, 440)).toBeCloseTo(1811.57, 2); expect(clickHz(1100, 440)).toBeCloseTo(1077.17, 2); expect(clickHz(750, 440)).toBeCloseTo(761.67, 2)
  })
  test('an invalid reference falls back to 440', () => { expect(clickHz(1800, NaN)).toBeCloseTo(clickHz(1800, 440), 6); expect(clickHz(1800, 0)).toBeCloseTo(clickHz(1800, 440), 6) })
})

describe('isClickPitch', () => {
  test('every note from C2 to C8 played less than 30 cents off is never taken for a click, at any reference', () => {
    for (const ref of [410, 415, 432, 440, 442, 466]) for (let semi = -45; semi <= 39; semi++) for (const off of [-29.5, -20, -10, 0, 10, 20, 29.5])
      expect(isClickPitch(ref * Math.pow(2, (semi + off / 100) / 12), ref), `ref ${ref} semi ${semi} ${off}`).toBe(false)
  })
  test('the clicks themselves, in any octave and up to the reading spread, are', () => {
    for (const ref of [415, 440, 442, 466]) for (const base of Object.values(CLICK_BASE_HZ)) for (const oct of [0.25, 0.5, 1, 2]) for (const off of [-(CLICK_REJECT_CENTS - 1), 0, CLICK_REJECT_CENTS - 1])
      expect(isClickPitch(clickHz(base, ref) * oct * Math.pow(2, off / 1200), ref)).toBe(true)
  })
  test('no pitch → false', () => { expect(isClickPitch(-1, 440)).toBe(false); expect(isClickPitch(0, 440)).toBe(false) })
})
