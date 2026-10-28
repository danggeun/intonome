import { describe, test, expect } from 'vitest'
import { plan } from './lib/affected.mjs'

describe('changed files pick the checks to run', () => {
  test('docs only: nothing but typecheck', () => {
    expect(plan(['README.md', 'docs/ARCHITECTURE.md'])).toEqual({ unit: [], e2e: 'none', bench: false, shots: false })
  })
  test('a tuner algorithm file: related unit tests, tuner e2e and the benchmark', () => {
    const p = plan(['www/src/core/pitch/tracker.ts'])
    expect(p.unit).toEqual(['www/src/core/pitch/tracker.ts'])
    expect(p.bench).toBe(true)
    expect(p.e2e).toMatch(/tuner/)
    expect(new RegExp(p.e2e).test('tuner: cello C2 → 도2 (Hz readout keeps its width with two digits)')).toBe(true)
    expect(new RegExp(p.e2e).test('rec: start/stop → list item, persists reload, rename persists, delete')).toBe(false)
  })
  test('the editor: editor and playback scenarios, no benchmark', () => {
    const p = plan(['www/src/ui/editor.ts'])
    expect(new RegExp(p.e2e).test('editor: A/B/loop/bookmark flows')).toBe(true)
    expect(new RegExp(p.e2e).test('playback: quiet recordings get correction gain and keep playing')).toBe(true)
    expect(p.bench).toBe(false)
  })
  test('the wiring or the e2e script itself: everything', () => {
    expect(plan(['www/src/main.ts']).e2e).toBe('all')
    expect(plan(['scripts/e2e.mjs']).e2e).toBe('all')
    expect(plan(['www/src/main.ts']).shots).toBe(true)
  })
  test('styles: layout scenarios and screenshots', () => {
    const p = plan(['www/src/style.css'])
    expect(p.shots).toBe(true)
    expect(new RegExp(p.e2e).test('layout: full mode iPhone SE 375×667 — no scroll or overflow, text keeps its rendered size')).toBe(true)
  })
  test('a test file alone runs only that test', () => {
    expect(plan(['www/src/core/note.test.ts'])).toEqual({ unit: ['www/src/core/note.test.ts'], e2e: 'none', bench: false, shots: false })
  })
  test('an app file the table does not know: everything (wide when unsure)', () => {
    expect(plan(['www/src/ui/brandNew.ts']).e2e).toBe('all')
  })
  test('Windows paths are read the same', () => {
    expect(plan(['www\\src\\core\\pitch\\tracker.ts']).bench).toBe(true)
  })
  test('build config: all unit tests', () => {
    expect(plan(['package.json']).unit).toBe('all')
  })
})
