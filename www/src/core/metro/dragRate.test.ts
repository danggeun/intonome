import { describe, test, expect } from 'vitest'
import { createBpmDrag, pxPerBpm, PX_SLOW, PX_FAST } from './dragRate.ts'

/** dist px 를 ms 동안 step px 씩 고르게 끈다(위로 = +) */
function drag(start: number, dist: number, ms: number, step = 4, min = 40, max = 200): number {
  const d = createBpmDrag(start, min, max, 1000, 0)
  const n = Math.max(1, Math.round(Math.abs(dist) / step)); let v = start
  for (let i = 1; i <= n; i++) v = d.move(1000 - dist * i / n, ms * i / n)
  return v
}

describe('BPM drag rate follows finger speed', () => {
  test('slow drag is fine: 6 px per BPM', () => {
    expect(pxPerBpm(0.1)).toBe(PX_SLOW)
    expect(drag(80, 60, 600)).toBe(90)    // 0.1 px/ms
    expect(drag(80, -60, 600)).toBe(70)
  })
  test('fast flick is coarse: 2 px per BPM, as before', () => {
    expect(pxPerBpm(2)).toBe(PX_FAST)
    expect(drag(80, 200, 100, 20)).toBe(180) // 2 px/ms
  })
  test('a 2-3 px wobble while lifting the finger slowly does not change the value', () => {
    const d = createBpmDrag(84, 40, 200, 500, 0)
    let v = 84
    for (const [y, t] of [[501, 40], [502, 80], [500, 120], [499, 160], [501, 200]] as const) v = d.move(y, t)
    expect(v).toBe(84)
  })
  test('stops at the ends and turns back at once', () => {
    const d = createBpmDrag(195, 40, 200, 1000, 0)
    let v = 0
    for (let i = 1; i <= 20; i++) v = d.move(1000 - 20 * i, 10 * i) // far past 200
    expect(v).toBe(200)
    v = d.move(1000 - 400 + 12, 1000)                                // back down 12 px slowly
    expect(v).toBe(198)
  })
  test('same input, same result; repeated timestamps do not blow up', () => {
    expect(drag(100, 90, 500)).toBe(drag(100, 90, 500))
    const d = createBpmDrag(100, 40, 200, 0, 0)
    expect(Number.isFinite(d.move(-6, 0))).toBe(true)
  })
})
