import { describe, test, expect } from 'vitest'
import { fmt, fmtT, fmtTenths, playedRatio, fmtMonthDay } from './format.ts'

describe('fmtTenths (A and B points)', () => {
  test('shows tenths so a 0.25 s nudge is visible', () => {
    expect(fmtTenths(1.25)).toBe('00:01.2')
    expect(fmtTenths(1.5)).toBe('00:01.5')
    expect(fmtTenths(1.2)).toBe('00:01.2') // 1.2 × 10 is 11.999… in floating point
    expect(fmtTenths(75.95)).toBe('01:15.9')
  })
  test('bad values read 00:00.0', () => { expect(fmtTenths(-1)).toBe('00:00.0'); expect(fmtTenths(NaN)).toBe('00:00.0') })
})

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

describe('fmtMonthDay — recording dates read the same way in every language', () => {
  test('Korean and Japanese keep month/day digits', () => {
    expect(fmtMonthDay(11, 7, 'ko')).toBe('11/7')
    expect(fmtMonthDay(11, 7, 'ja')).toBe('11/7')
  })
  test('English and Spanish name the month (11/7 reads as 11 July outside the US)', () => {
    expect(fmtMonthDay(11, 7, 'en')).toBe('Nov 7')
    expect(fmtMonthDay(11, 7, 'es')).toMatch(/^7 nov$/)
  })
  test('Chinese uses 月日', () => {
    expect(fmtMonthDay(11, 7, 'zh-Hans')).toBe('11月7日')
    expect(fmtMonthDay(1, 23, 'zh-Hant')).toBe('1月23日')
  })
})
