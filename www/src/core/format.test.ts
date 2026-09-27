import { describe, test, expect } from 'vitest'
import { fmt, fmtT, playedRatio } from './format.ts'

describe('fmt', () => {
  test('zero seconds', () => expect(fmt(0)).toBe('00:00'))
  test('one minute five seconds', () => expect(fmt(65)).toBe('01:05'))
  test('pads single digit', () => expect(fmt(9)).toBe('00:09'))
  test('over one hour', () => expect(fmt(3661)).toBe('61:01'))
})

describe('fmtT', () => {
  test('returns 00:00 for negative', () => expect(fmtT(-1)).toBe('00:00'))
  test('returns 00:00 for NaN', () => expect(fmtT(NaN)).toBe('00:00'))
  test('returns 00:00 for Infinity', () => expect(fmtT(Infinity)).toBe('00:00'))
  test('floors fractional seconds', () => expect(fmtT(90.9)).toBe('01:30'))
  test('zero', () => expect(fmtT(0)).toBe('00:00'))
})

describe('playedRatio (header timer fill)', () => {
  test('played ÷ elapsed, 0 before anything has elapsed, never outside 0–1', () => {
    expect(playedRatio(0, 0)).toBe(0); expect(playedRatio(5, 0)).toBe(0)
    expect(playedRatio(754, 1510)).toBeCloseTo(0.4993, 4); expect(playedRatio(30, 30)).toBe(1)
    expect(playedRatio(31, 30)).toBe(1); expect(playedRatio(-1, 30)).toBe(0)
  })
})
