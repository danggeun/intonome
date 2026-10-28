import { describe, test, expect } from 'vitest'
import { release, onHide, type HideNow } from './micLease.ts'

const idle: HideNow = { micOpen: true, opening: false, recording: false, native: false, metroPlaying: false, droneOn: false, refToneOn: false, hasPendingToast: false }

describe('letting go of the mic for a while (hidden screen, editor)', () => {
  test('an open mic is closed, one that is still opening is cancelled, a recording keeps it', () => {
    expect(release({ micOpen: true, opening: false, recording: false })).toBe('close')
    expect(release({ micOpen: false, opening: true, recording: false })).toBe('cancel')
    expect(release({ micOpen: true, opening: false, recording: true })).toBe('keep')
    expect(release({ micOpen: false, opening: false, recording: false })).toBe('keep')
  })
})

describe('the screen goes to the background', () => {
  test('nothing sounding: the mic is let go and nothing is announced', () => {
    expect(onHide(idle)).toEqual({ stopRec: false, stopMetro: false, setPending: null, release: 'close' })
  })
  test('the metronome, the drone or Play A was sounding: say so on return', () => {
    expect(onHide({ ...idle, metroPlaying: true })).toMatchObject({ stopMetro: true, setPending: 'app.stoppedOnHide' })
    expect(onHide({ ...idle, droneOn: true })).toMatchObject({ stopMetro: false, setPending: 'app.stoppedOnHide' })
    expect(onHide({ ...idle, refToneOn: true }).setPending).toBe('app.stoppedOnHide')
  })
  test('a notice already waiting is not replaced by the "stopped" one', () => {
    expect(onHide({ ...idle, metroPlaying: true, hasPendingToast: true }).setPending).toBe(null)
  })
  test('on the web a recording keeps the mic (a recording must not break)', () => {
    expect(onHide({ ...idle, recording: true })).toEqual({ stopRec: false, stopMetro: false, setPending: null, release: 'keep' })
  })
  test('in the Android app a recording is saved first, then the mic is let go, and the saved notice wins', () => {
    expect(onHide({ ...idle, native: true, recording: true, metroPlaying: true, hasPendingToast: true }))
      .toEqual({ stopRec: true, stopMetro: true, setPending: 'rec.savedOnHide', release: 'close' })
  })
  test('hidden while the mic is still opening: the opening is cancelled', () => {
    expect(onHide({ ...idle, micOpen: false, opening: true }).release).toBe('cancel')
  })
})
