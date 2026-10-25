import { describe, test, expect, beforeEach, vi } from 'vitest'
import { tourPending, markTourDone, isNewInstall, TOUR_KEY } from './tour.ts'
import { SETTINGS_KEY } from './settings.ts'
import { DONE_KEY as LEGACY_DONE_KEY } from './legacy.ts'

/** 처음 안내를 누가 보는가: 새로 설치한 기기만. 업데이트로 받은 사람(저장된 설정이 있다)은 저절로 뜨지 않는다 */
describe('who sees the first-run guide', () => {
  let store: Record<string, string>
  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  test('a new install (no saved settings) sees it, and keeps seeing it until it is finished or closed', () => {
    expect(tourPending(true)).toBe(true)
    expect(store[TOUR_KEY]).toBe('new')
    // 다음 실행: 그새 설정이 저장돼 첫 실행이 아니어도, 끝내지 않았으면 다시
    expect(tourPending(false)).toBe(true)
    markTourDone()
    expect(tourPending(false)).toBe(false)
    expect(tourPending(true)).toBe(false)
  })

  test('an existing install (an update) never sees it on its own, even after its settings are cleared later', () => {
    expect(tourPending(false)).toBe(false)
    expect(store[TOUR_KEY]).toBe('done')
    expect(tourPending(true)).toBe(false)
  })

  test('where storage is unavailable it is not shown (it would come back on every launch)', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } })
    expect(tourPending(true)).toBe(false)
    expect(() => markTourDone()).not.toThrow()
  })
})

describe('what counts as a new install', () => {
  let store: Record<string, string>
  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
  })
  test('nothing stored: new', () => expect(isNewInstall()).toBe(true))
  test('saved settings: not new', () => { store[SETTINGS_KEY] = '{}'; expect(isNewInstall()).toBe(false) })
  test('no saved settings but the app has run before (never changed a setting): not new', () => { store[LEGACY_DONE_KEY] = '1'; expect(isNewInstall()).toBe(false) })
  test('storage unavailable: not new', () => { vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied') } }); expect(isNewInstall()).toBe(false) })
})
