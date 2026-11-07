import { describe, test, expect } from 'vitest'
import { fontScaleFor, FONT_SCALE_MAX, FONT_SCALE_MIN } from './index.ts'

describe('fontScaleFor — Android system font size into the app type scale', () => {
  test('default stays at 1; smaller sizes are kept down to 0.85', () => { expect(fontScaleFor(1)).toBe(1); expect(fontScaleFor(0.9)).toBe(0.9); expect(fontScaleFor(0.5)).toBe(FONT_SCALE_MIN) })
  test('larger sizes grow the text, up to 1.3', () => { expect(fontScaleFor(1.15)).toBe(1.15); expect(fontScaleFor(2)).toBe(FONT_SCALE_MAX) })
  test('a bad value is ignored', () => { expect(fontScaleFor(NaN)).toBe(1); expect(fontScaleFor(0)).toBe(1) })
})
