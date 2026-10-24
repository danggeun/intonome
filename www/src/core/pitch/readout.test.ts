import { describe, test, expect } from 'vitest'
import { createReadout } from './readout.ts'

const P = { windowFrames: 16, deadband: 1.5, trendFrames: 6, trendCents: 3 }
describe('readout: the number people read', () => {
  test('a new note shows its value at once; no note shows 0', () => {
    const r = createReadout(P)
    expect(r.push(69, 7.4, true)).toBe(7)
    expect(r.push(-1, 0, false)).toBe(0)
    expect(r.push(71, -12.6, true)).toBe(-13)
  })
  test('vibrato around a steady centre keeps the number still', () => {
    const r = createReadout(P); const seen = new Set<number>()
    for (let i = 0; i < 200; i++) { const n = r.push(69, 4 + 12 * Math.sin(2 * Math.PI * 5.5 * i * 0.0232), true); if (i > 20) seen.add(n) }
    expect(seen.size).toBe(1); expect(Math.abs([...seen][0]! - 4)).toBeLessThanOrEqual(1)
  })
  test('a steady drift (turning a peg) is followed without waiting for the average', () => {
    const r = createReadout(P); let n = 0
    for (let i = 0; i < 40; i++) n = r.push(69, -30 + i, true) // 프레임당 1 ¢
    expect(Math.abs(n - 9)).toBeLessThanOrEqual(4)
  })
  test('held frames do not enter the average; a note change starts over', () => {
    const r = createReadout(P)
    for (let i = 0; i < 16; i++) r.push(69, 10, true)
    expect(r.push(69, -40, false)).toBe(10) // 유지 프레임의 값은 무시
    expect(r.push(70, -20, true)).toBe(-20)
  })
})
