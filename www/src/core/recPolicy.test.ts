import { describe, test, expect } from 'vitest'
import { trustedDuration, expires, warnDaysLeft, REC_TTL } from './recPolicy.ts'

const NOW = 1_800_000_000_000
const day = 86400000

describe('expires', () => {
  test('an unkept item older than 31 days expires', () => expect(expires(NOW - REC_TTL - day, false, true, NOW)).toBe(true))
  test('kept items don’t expire', () => expect(expires(NOW - REC_TTL - day, true, true, NOW)).toBe(false))
  test('nothing expires with auto-delete off', () => expect(expires(NOW - REC_TTL - day, false, false, NOW)).toBe(false))
  test('younger than 30 days doesn’t expire', () => expect(expires(NOW - 29 * day, false, true, NOW)).toBe(false))
  test('old rows without ts are kept', () => expect(expires(undefined, false, true, NOW)).toBe(false))
})

describe('warnDaysLeft', () => {
  test('last-7-days boundary — notice at 6 days left, quiet at 7', () => {
    expect(warnDaysLeft(NOW - 24 * day, false, true, NOW)).toBe(6)
    expect(warnDaysLeft(NOW - 23 * day, false, true, NOW)).toBe(null)
  })
  test('3 days left', () => expect(warnDaysLeft(NOW - 27 * day, false, true, NOW)).toBe(3))
  test('deletes today', () => expect(warnDaysLeft(NOW - 30 * day + 1000, false, true, NOW)).toBe(0))
  test('quiet at 8 days left', () => expect(warnDaysLeft(NOW - 22 * day, false, true, NOW)).toBe(null))
  test('no notice for kept items', () => expect(warnDaysLeft(NOW - 27 * day, true, true, NOW)).toBe(null))
  test('no notice with auto-delete off', () => expect(warnDaysLeft(NOW - 27 * day, false, false, NOW)).toBe(null))
})

describe('trustedDuration — the length the player and the seek bar use', () => {
  test('a sane media duration is used as is (more precise than the recorder clock)', () => expect(trustedDuration(47, 46.8)).toBe(46.8))
  test('Infinity (Chromium webm before a seek) falls back to the recorded length', () => expect(trustedDuration(47, Infinity)).toBe(47))
  test('a garbage finite duration (Android Chrome: 75 hours for a 47 s webm) falls back to the recorded length', () => {
    expect(trustedDuration(47, 270020)).toBe(47); expect(trustedDuration(47, 519127)).toBe(47)
  })
  test('too short is not trusted either; unknown values fall back', () => {
    expect(trustedDuration(47, 3)).toBe(47); expect(trustedDuration(47, NaN)).toBe(47); expect(trustedDuration(47, undefined)).toBe(47); expect(trustedDuration(47, 0)).toBe(47)
  })
  test('with no recorded length (an old row) the media duration is all there is', () => expect(trustedDuration(0, 12.5)).toBe(12.5))
})
