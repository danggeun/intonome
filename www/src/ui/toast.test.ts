import { describe, test, expect } from 'vitest'
import { evictIndex, holdNotice } from './toast.ts'

describe('holdNotice — notices that arrive while the app is hidden', () => {
  test('kept in order, shown on return', () => {
    expect(holdNotice(holdNotice([], { msg: 'a', ms: 1 }), { msg: 'b', ms: 2 }).map(h => h.msg)).toEqual(['a', 'b'])
  })
  test('the same notice twice is one, with the later time', () => {
    expect(holdNotice([{ msg: 'a', ms: 1 }, { msg: 'b', ms: 2 }], { msg: 'a', ms: 9 })).toEqual([{ msg: 'a', ms: 9 }, { msg: 'b', ms: 2 }])
  })
  test('notices with an action (undo) are each kept', () => {
    const f = () => {}, g = () => {}
    expect(holdNotice([{ msg: 'a', ms: 1, action: f }], { msg: 'a', ms: 1, action: g })).toHaveLength(2)
  })
})

describe('evictIndex — which toast goes when there are too many', () => {
  test('oldest one without an action first', () => {
    expect(evictIndex([true, false, false])).toBe(1)
    expect(evictIndex([false, true, true])).toBe(0)
  })
  test('oldest one when all have actions', () => expect(evictIndex([true, true, true])).toBe(0))
  test('empty list', () => expect(evictIndex([])).toBe(-1))
})
