import { describe, test, expect } from 'vitest'
import { afterUnmute, recDurSec, CUT_MS } from './recCut.ts'

describe('the mic is muted by the system during a recording', () => {
  test('a blip (a Bluetooth route change) carries on; a screen-off or a call ends the file where the mic went quiet', () => {
    expect(afterUnmute(300)).toBe('resume')
    expect(afterUnmute(CUT_MS - 1)).toBe('resume')
    expect(afterUnmute(CUT_MS)).toBe('cut')
    expect(afterUnmute(3 * 60_000)).toBe('cut')
  })
  test('the length stops where the mic went quiet, and a blip that carried on is not counted', () => {
    expect(recDurSec(0, 200_000, 20_000, 0)).toBe(20) // muted at 20 s, back after 3 minutes → 20 s file
    expect(recDurSec(0, 30_000, 0, 1_000)).toBe(29) // a 1 s blip in a 30 s take
    expect(recDurSec(0, 30_000, 0, 0)).toBe(30)
    expect(recDurSec(0, 300, 0, 0)).toBe(1) // a tap on REC and off again: never 0, which would read as 'length unknown'
  })
})
