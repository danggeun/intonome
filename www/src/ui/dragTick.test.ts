import { describe, test, expect } from 'vitest'
import { reachesTen } from './dragTick.ts'

describe('drag tick: strong on every multiple of ten it reaches', () => {
  test('up: on landing on 90, not after', () => {
    expect(reachesTen(89, 90)).toBe(true); expect(reachesTen(90, 91)).toBe(false); expect(reachesTen(88, 89)).toBe(false)
  })
  test('down: on landing on 90, not when leaving it', () => {
    expect(reachesTen(91, 90)).toBe(true); expect(reachesTen(90, 89)).toBe(false); expect(reachesTen(92, 91)).toBe(false)
  })
  test('a jump over a ten counts; Hz works the same (441 → 440, 450 → 449 no)', () => {
    expect(reachesTen(88, 92)).toBe(true); expect(reachesTen(92, 88)).toBe(true); expect(reachesTen(91, 99)).toBe(false)
    expect(reachesTen(441, 440)).toBe(true); expect(reachesTen(450, 449)).toBe(false); expect(reachesTen(439, 440)).toBe(true)
  })
})
