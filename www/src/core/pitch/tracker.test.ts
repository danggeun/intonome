import { describe, test, expect } from 'vitest'
import { createTracker } from './tracker.ts'

const A = 0.14
describe('tracker', () => {
  test('acquires after three consistent frames, holds through short dropouts, releases after releaseFrames', () => {
    const t = createTracker()
    expect(t.push(440, 0.95, true, A).midi).toBe(-1); expect(t.push(440, 0.95, true, A).midi).toBe(-1) // 자신 있는 한두 프레임으로는 안 띄운다
    expect(t.push(440, 0.95, true, A).midi).toBe(69)
    for (let i = 0; i < 20; i++) expect(t.push(-1, 0, false, A).midi).toBe(69) // 20 misses (≈ 430 ms) 동안 유지 — 활을 들었다 놓는 틈
    expect(t.push(-1, 0, false, A).midi).toBe(-1) // 21 → release
  })
  test('scattered pitches never acquire — a syllable, a bird, a click (two periodic frames) show nothing', () => {
    const t = createTracker()
    for (const hz of [440, 523, 392, 659, 440, 466]) expect(t.push(hz, 0.95, true, A).midi).toBe(-1) // 프레임마다 다른 음
    for (const hz of [440, 440]) expect(t.push(hz, 0.95, true, A).midi).toBe(-1) // 두 프레임만 같은 음
    expect(t.push(-1, 0, false, A).midi).toBe(-1)
    // 미끄러져 올라오는 피치(프레임당 30 ¢)는 멈출 때까지 안 띄운다
    const t2 = createTracker(); const up = (c: number) => 440 * Math.pow(2, c / 1200)
    for (const c of [-150, -120, -90, -60, -30]) expect(t2.push(up(c), 0.95, true, A).midi).toBe(-1)
    expect(t2.push(up(0), 0.95, true, A).midi).toBe(-1); expect(t2.push(up(0), 0.95, true, A).midi).toBe(-1) // 창에 아직 −30 이 남아 있다
    expect(t2.push(up(0), 0.95, true, A).midi).toBe(69)
  })
  test('hysteresis: a momentary ±60¢ jump keeps the note name (the smoothed value is still within half a semitone)', () => {
    const t = createTracker()
    for (let i = 0; i < 3; i++) t.push(440, 0.95, true, A)
    const up60 = 440 * Math.pow(2, 60 / 1200)
    // 3프레임까지는 평활 때문에 표시값이 +40 ¢ 을 넘지 않는다 → 라벨 유지
    for (let i = 0; i < 3; i++) expect(t.push(up60, 0.95, true, A).midi).toBe(69)
  })
  test('hysteresis: a sustained +60¢ eventually switches to the neighbor (it really is closer)', () => {
    const t = createTracker()
    for (let i = 0; i < 3; i++) t.push(440, 0.95, true, A)
    const up60 = 440 * Math.pow(2, 60 / 1200)
    let last = 69
    for (let i = 0; i < 12; i++) last = t.push(up60, 0.95, true, A).midi
    expect(last).toBe(70) // 라♯4 −40 ¢ 으로 보이는 게 맞다. '라4 +60 ¢' 는 가장 가까운 음이 아니다
  })
  test('real change switches within 3 frames', () => {
    const t = createTracker()
    for (let i = 0; i < 6; i++) t.push(440, 0.95, true, A)
    expect(t.push(494, 0.7, true, A).midi).toBe(69) // 중앙값(3)이 아직 이전 음
    expect(t.push(494, 0.7, true, A).midi).toBe(69) // 1st outside frame
    expect(t.push(494, 0.7, true, A).midi).toBe(71) // 2nd → switch to B4 (총 3프레임 ≈ 70 ms)
  })
  test('outlier frame is rejected by weighted median', () => {
    const t = createTracker()
    for (let i = 0; i < 3; i++) t.push(440, 0.95, true, A)
    const r = t.push(880, 0.6, true, A) // 한 프레임 옥타브 튐
    expect(r.midi).toBe(69); expect(Math.abs(1200 * Math.log2(r.hz / 440))).toBeLessThan(5)
  })
  test('adaptive smoothing: large step converges within a few frames', () => {
    const t = createTracker(); t.push(440, 0.95, true, A)
    let r = t.push(440, 0.95, true, A)
    for (let i = 0; i < 4; i++) r = t.push(466.16, 0.95, true, A) // +100¢ (A♯4)
    expect(r.midi).toBe(70); expect(Math.abs(1200 * Math.log2(r.hz / 466.16))).toBeLessThan(15)
  })

  test('display consistency: cents (= dispA − label center) always within ±50 ¢', () => {
    // 재현: 한 방향으로 4프레임 이상 움직이면 적응 부스트가 dispA 를 새 음까지 끌어다 놓는데,
    // 라벨은 switchFrames 만큼 기다린다 → 그 사이 화면에 두 음의 간격(100~190 ¢)이 찍혔다.
    const t = createTracker()
    const a = 1200 * Math.log2(440 / 440) // A4 = 0 ¢
    for (let i = 0; i < 20; i++) t.push(440, 0.95, true, 0.12)   // A4 지속
    let worst = 0
    // 레가토로 B4(+200 ¢)까지 한 방향 이동 — 부스트가 걸리는 조건
    for (let i = 1; i <= 12; i++) {
      const cents = a + Math.min(200, i * 25)
      const o = t.push(440 * Math.pow(2, cents / 1200), 0.95, true, 0.12)
      if (o.midi >= 0) worst = Math.max(worst, Math.abs(o.a - (o.midi - 69) * 100))
    }
    expect(worst).toBeLessThanOrEqual(50)
  })

  test('a far candidate never drags the needle — the display is either the old value or the confirmed new one, never in between', () => {
    // 2.4.6 까지: 옥타브 아래 후보(−1200 ¢)가 들어오면 전환을 기다리는 동안 dispA 가 그쪽으로 미끄러져 시3·도♯3 같은 낸 적 없는 중간 음이 찍혔다
    const t = createTracker()
    for (let i = 0; i < 6; i++) t.push(196, 0.95, true, 0.2)
    const a0 = t.push(196, 0.95, true, 0.2).a
    const near = (x: number, y: number) => Math.abs(x - y) < 1
    // 한 프레임 튐: 중앙값이 삼킨다 — 바늘 그대로
    let o = t.push(98, 0.95, true, 0.2); expect(o.midi).toBe(55); expect(near(o.a, a0)).toBe(true)
    o = t.push(196, 0.95, true, 0.2); expect(o.midi).toBe(55); expect(near(o.a, a0)).toBe(true)
    // 이어지는 후보: 어느 프레임에서도 표시값은 옛 값(0 ¢ 근처) 아니면 새 값(−1200 ¢ 근처) — 그 사이 값은 없다
    const seen: number[] = []
    for (let i = 0; i < 6; i++) { o = t.push(98, 0.95, true, 0.2); seen.push(o.midi); expect(near(o.a, a0) || near(o.a, a0 - 1200), `frame ${i}: a=${o.a.toFixed(1)}`).toBe(true) }
    expect(seen[0]).toBe(55); expect(seen[5]).toBe(43); expect(new Set(seen).size).toBe(2) // 솔3 → 솔2 로 한 번만 바뀐다
  })
  test('a slide keeps being followed past the switch band (the needle is already near the median)', () => {
    const t = createTracker()
    for (let i = 0; i < 6; i++) t.push(440, 0.95, true, 0.2)
    let prev = -Infinity, back = 0, last = 0
    for (let i = 1; i <= 16; i++) { const o = t.push(440 * Math.pow(2, i * 20 / 1200), 0.95, true, 0.2); if (o.a < prev - 1e-9) back++; prev = o.a; last = o.a } // 20 ¢ 씩 320 ¢ 까지 (라→시 를 지나 도♯ 까지)
    expect(back).toBe(0); expect(last).toBeGreaterThan(250) // 뒤로 간 적 없고, 끝에서 목표(320 ¢) 가까이
  })

  test('inside metronome click windows a different note needs three frames, outside two', () => {
    const settle = () => { const t = createTracker(); for (let i = 0; i < 6; i++) t.push(440, 0.95, true, A); return t }
    const a = settle(); expect(a.push(659, .95, true, A, true).midi).toBe(69); expect(a.push(659, .95, true, A, true).midi).toBe(69)
    expect(a.push(440, .95, true, A, true).midi).toBe(69) // 클릭이 섞인 두 프레임의 가짜 음은 화면에 안 나온다
    // 중앙값(3)이 새 음으로 넘어간 뒤부터 센다: 평소엔 셋째 프레임, 클릭 구간에선 넷째 프레임에 바뀐다
    const b = settle(); for (let i = 0; i < 3; i++) expect(b.push(659, .95, true, A, true).midi).toBe(69); expect(b.push(659, .95, true, A, true).midi).toBe(76)
    const c = settle(); c.push(659, .95, true, A); c.push(659, .95, true, A); expect(c.push(659, .95, true, A).midi).toBe(76)
  })

  test('held count: +1 per missing frame, 0 on a fresh measurement (so the trace leaves no horizontal line)', () => {
    const t = createTracker()
    for (let i = 0; i < 4; i++) expect(t.push(440, 0.95, true, A).held).toBe(0)
    expect(t.push(-1, 0, false, A).held).toBe(1)
    expect(t.push(-1, 0, false, A).held).toBe(2)
    expect(t.push(440, 0.95, true, A).held).toBe(0) // 다시 잡히면 0
  })
})
