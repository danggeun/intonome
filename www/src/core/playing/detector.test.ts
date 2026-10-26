import { describe, test, expect } from 'vitest'
import { createDetector, DEFAULT_DETECTOR } from './detector.ts'

const good = { conf: 0.9, rmsOk: true, harmonics: 4, flatness: 0.1 }
const bad = { conf: 0.2, rmsOk: true, harmonics: 0, flatness: 0.8 }
describe('detector', () => {
  test('turns on only after attackFrames of continuous qualifying frames', () => {
    const d = createDetector()
    for (let i = 0; i < DEFAULT_DETECTOR.attackFrames - 1; i++) expect(d.push(good)).toBe(false)
    expect(d.push(good)).toBe(true)
  })
  test('short bursts (≤ 4 frames) with 3-frame gaps never turn on', () => {
    const d = createDetector()
    for (let k = 0; k < 10; k++) { for (let i = 0; i < 4; i++) expect(d.push(good)).toBe(false); for (let i = 0; i < 3; i++) expect(d.push(bad)).toBe(false) }
  })
  test('a single sub-threshold frame during attack only costs missPenalty, not a reset', () => {
    const d = createDetector()
    for (let i = 0; i < 4; i++) d.push(good) // 4
    d.push(bad) // 4 → 2
    for (let i = 0; i < 3; i++) expect(d.push(good)).toBe(false) // 2 → 5
    expect(d.push(good)).toBe(true) // 6
  })
  test('staccato: 150 ms notes with 100 ms gaps stay ON once started', () => {
    const d = createDetector(); let on = false
    for (let k = 0; k < 6; k++) { for (let i = 0; i < 7; i++) on = d.push(good); for (let i = 0; i < 4; i++) on = d.push(bad); if (k >= 1) expect(on).toBe(true) }
  })
  test('monotonic pitch drift (intonation) blocks attack; vibrato (oscillating) does not', () => {
    const drift = createDetector()
    for (let i = 0; i < 12; i++) drift.push({ ...good, cents: i * 20 }) // 20¢/프레임(≈860¢/s) 급한 억양
    expect(drift.on).toBe(false)
    const vib = createDetector(); let on = false
    for (let i = 0; i < 12; i++) on = vib.push({ ...good, cents: 30 * Math.sin(i * 0.9) })
    expect(on).toBe(true)
  })
  test('flageolet: 1 harmonic but conf ≥ 0.9 qualifies', () => {
    const d = createDetector(); let on = false
    for (let i = 0; i < 20; i++) on = d.push({ conf: 0.95, rmsOk: true, harmonics: 1, flatness: 0.05 })
    expect(on).toBe(true)
  })
  test('holds through gaps shorter than holdFrames, then off', () => {
    const d = createDetector(); for (let i = 0; i < DEFAULT_DETECTOR.attackFrames; i++) d.push(good)
    for (let i = 0; i < DEFAULT_DETECTOR.holdFrames - 1; i++) expect(d.push(bad)).toBe(true)
    expect(d.push(bad)).toBe(false)
  })
  test('after a long stretch of playing, silence turns it off within holdFrames + 1 — the count does not pile up', () => {
    // 2.5.7 까지: run 에 상한이 없어 2 분 연주 뒤 쉬면 약 60 s 동안(11 프레임 ON · 1 프레임 OFF 반복) 계속 '연주 중' 으로 셌다
    const d = createDetector()
    for (let i = 0; i < 120 * 43; i++) d.push(good) // 약 2 분
    let offAt = -1
    for (let i = 0; i < 200; i++) if (!d.push(bad)) { offAt = i; break }
    expect(offAt).toBeGreaterThanOrEqual(0); expect(offAt).toBeLessThanOrEqual(DEFAULT_DETECTOR.holdFrames)
    for (let i = 0; i < 100; i++) expect(d.push(bad)).toBe(false) // 다시 켜지지 않는다
  })
  test('a wild frame or two at the onset (harmonic, click) does not delay the start — on 6 frames after the pitch settles', () => {
    // 2.5.7 까지: 시작의 +963 ¢·−2400 ¢ 두 프레임이 24 프레임 창의 기울기를 지배해 그동안 attack 이 매번 버려졌다(≈ 0.5 s 늦게 켜짐)
    const d = createDetector()
    d.push({ ...good, cents: 963 }); d.push({ ...good, cents: -2400 })
    let onAt = -1
    for (let i = 0; i < 30; i++) if (d.push({ ...good, cents: (i % 3) - 1 })) { onAt = i; break }
    expect(onAt).toBeGreaterThanOrEqual(0); expect(onAt).toBeLessThanOrEqual(DEFAULT_DETECTOR.attackFrames)
  })
  test('noise (flat spectrum) never qualifies even if periodic-ish', () => {
    const d = createDetector(); for (let i = 0; i < 40; i++) expect(d.push({ conf: 0.7, rmsOk: true, harmonics: 3, flatness: 0.7 })).toBe(false)
  })
})
