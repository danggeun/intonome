import { describe, test, expect } from 'vitest'
import { hzToMidi, midiToHz, centsFrom, noteName, octaveOf, splitAccidental, ENHARMONIC, noteLabel, droneName } from './note.ts'

describe('note math', () => {
  test('A4 440 → midi 69, Korean name "라", octave 4', () => {
    expect(hzToMidi(440)).toBe(69); expect(noteName(69)).toBe('라'); expect(octaveOf(69)).toBe(4)
  })
  test('C2 65.41 → midi 36, Korean name "도", octave 2', () => { expect(hzToMidi(65.41)).toBe(36); expect(noteName(36)).toBe('도'); expect(octaveOf(36)).toBe(2) })
  test('440 Hz at A=442 → −8 cents (as in v1)', () => expect(centsFrom(440, 69, 442)).toBe(-8))
  test('midiToHz round-trips', () => expect(midiToHz(69, 442)).toBeCloseTo(442, 6))
  test('splitAccidental', () => { expect(splitAccidental('도♯')).toEqual({ base: '도', acc: '♯' }); expect(splitAccidental('라')).toEqual({ base: '라', acc: '' }) })
  test('enharmonic table', () => { expect(ENHARMONIC['도♯']).toBe('레♭'); expect(ENHARMONIC['라']).toBeUndefined() })
})

describe('noteLabel — the secondary line is the other system', () => {
  const G = 67, As = 70 // 솔4, 라♯4
  test('Korean names (do re mi): naturals show one letter name, sharps show letter/letter enharmonic', () => {
    expect(noteLabel(G, 'ko')).toEqual({ name: '솔', secondary: 'G' })
    expect(noteLabel(As, 'ko')).toEqual({ name: '라♯', secondary: 'A♯/B♭' })
  })
  test('ABC: naturals show one Korean name, sharps show Korean/Korean enharmonic', () => {
    expect(noteLabel(G, 'en')).toEqual({ name: 'G', secondary: '솔' })
    expect(noteLabel(As, 'en')).toEqual({ name: 'A♯', secondary: '라♯/시♭' })
  })
  test('English screen: letter name only, the secondary line is just the enharmonic (no Korean)', () => {
    for (const sys of ['ko', 'en'] as const) {
      expect(noteLabel(G, sys, 'en')).toEqual({ name: 'G', secondary: '' })
      expect(noteLabel(As, sys, 'en')).toEqual({ name: 'A♯', secondary: 'B♭' })
    }
  })
  test('all 12 notes × 2 systems: no list dot (·), one token, 5 characters or fewer, never repeats the main name', () => {
    for (let m = 60; m < 72; m++) for (const sys of ['ko', 'en'] as const) {
      const { name, secondary } = noteLabel(m, sys)
      expect(secondary).not.toContain('·'); expect(secondary).not.toContain(' ')
      expect(secondary.length).toBeLessThanOrEqual(5)
      for (const part of secondary.split('/')) expect(part).not.toBe(name)
    }
  })
})

describe('droneName — string-practice spellings for the five black keys', () => {
  test('letters: C♯ E♭ F♯ A♭ B♭', () => expect([1, 3, 6, 8, 10].map(pc => droneName(pc, 'en', 'en'))).toEqual(['C♯', 'E♭', 'F♯', 'A♭', 'B♭']))
  test('Korean solfège', () => expect([1, 3, 6, 8, 10].map(pc => droneName(pc, 'ko', 'ko'))).toEqual(['도♯', '미♭', '파♯', '라♭', '시♭']))
  test('Japanese and Spanish solfège', () => {
    expect([3, 10].map(pc => droneName(pc, 'ko', 'ja'))).toEqual(['ミ♭', 'シ♭'])
    expect([3, 10].map(pc => droneName(pc, 'ko', 'es'))).toEqual(['Mi♭', 'Si♭'])
  })
  test('Chinese is always letters; white keys unchanged', () => {
    expect(droneName(10, 'ko', 'zh-Hans')).toBe('B♭')
    expect(droneName(0, 'ko', 'ko')).toBe('도'); expect(droneName(9, 'en', 'en')).toBe('A')
  })
})
