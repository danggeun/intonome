import { describe, test, expect } from 'vitest'
import { onNotice, notice, noticeListening } from './notice.ts'

describe('notice channel', () => {
  test('a message before anyone listens is dropped; after that it reaches the listener with its duration', () => {
    expect(noticeListening()).toBe(false)
    notice('early')
    const got: Array<[string, number | undefined]> = []
    onNotice((m, ms) => got.push([m, ms]))
    expect(noticeListening()).toBe(true)
    notice('saved')
    notice('long', 10000)
    expect(got).toEqual([['saved', undefined], ['long', 10000]])
  })
})
