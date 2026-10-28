import { describe, test, expect } from 'vitest'
import { placeBubble, type Box, type PlaceIn } from './tourPlace.ts'

const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height, right: left + width, bottom: top + height })
const base: Omit<PlaceIn, 'hole'> = { vw: 400, vh: 800, insetTop: 0, insetBottom: 0, cw: 300, ch: 150, hintGap: 0, hasPulse: false }

describe('tour bubble placement', () => {
  test('below the hole when it fits, centred on it and kept 16 px from the sides', () => {
    const r = placeBubble({ ...base, hole: box(10, 100, 80, 40) })
    expect(r).toMatchObject({ place: 'below', y: 152, x: 16 })
    expect(r.caret).toEqual({ side: false, at: 34 }) // points at the hole centre (50 − 16)
  })
  test('the first-page hint pushes it further down', () => {
    expect(placeBubble({ ...base, hole: box(50, 100, 300, 40), hintGap: 30 }).y).toBe(182)
  })
  test('above when there is no room below', () => {
    expect(placeBubble({ ...base, hole: box(50, 600, 300, 100) })).toMatchObject({ place: 'above', y: 438 })
  })
  test('beside a tall hole on a wide screen, caret near the top of the hole', () => {
    const r = placeBubble({ ...base, vw: 1200, hole: box(700, 100, 300, 650) })
    expect(r).toMatchObject({ place: 'left', x: 388, y: 100 })
    expect(r.caret).toEqual({ side: true, at: 28 })
  })
  test('inside a hole that fills the screen: low when a gesture marker is showing, high otherwise; never in the notch', () => {
    const full = box(0, 0, 400, 800)
    expect(placeBubble({ ...base, hole: full, hasPulse: true })).toMatchObject({ place: 'none', y: 638 })
    expect(placeBubble({ ...base, hole: full, insetTop: 47 })).toMatchObject({ place: 'none', y: 59 })
  })
  test('no hole (last page): centred', () => {
    expect(placeBubble({ ...base, hole: null })).toMatchObject({ place: 'none', x: 50, y: 325 })
  })
})
