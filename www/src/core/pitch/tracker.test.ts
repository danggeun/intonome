import { describe, test, expect } from 'vitest'
import { createTracker, DEFAULT_TRACKER, type Tracker } from './tracker.ts'

const A = 0.14
/** 무음에서 음을 띄운다(acquireFrames 프레임). 다른 동작을 보는 테스트의 준비 단계 */
const acquire = (t: Tracker, hz = 440, a = A): Tracker => { for (let i = 0; i < DEFAULT_TRACKER.acquireFrames; i++) t.push(hz, 0.95, true, a); return t }
describe('tracker', () => {
  test('acquires after seven consistent frames (≈ 0.15 s), holds through short dropouts, releases after releaseFrames', () => {
    const t = createTracker()
    for (let i = 0; i < 6; i++) expect(t.push(440, 0.95, true, A).midi).toBe(-1) // 말소리 모음 하나(0.1 s 남짓)로는 안 띄운다
    expect(t.push(440, 0.95, true, A).midi).toBe(69)
    for (let i = 0; i < 20; i++) expect(t.push(-1, 0, false, A).midi).toBe(69) // 20 misses (≈ 430 ms) 동안 유지 — 활을 들었다 놓는 틈
    expect(t.push(-1, 0, false, A).midi).toBe(-1) // 21 → release
  })
  test('scattered pitches never acquire — a syllable, a bird, a click (two periodic frames) show nothing', () => {
    const t = createTracker()
    for (const hz of [440, 523, 392, 659, 440, 466]) expect(t.push(hz, 0.95, true, A).midi).toBe(-1) // 프레임마다 다른 음
    for (const hz of [440, 440]) expect(t.push(hz, 0.95, true, A).midi).toBe(-1) // 두 프레임만 같은 음
    expect(t.push(-1, 0, false, A).midi).toBe(-1)
    // 미끄러져 올라오는 피치(프레임당 30 ¢)는 멈출 때까지 안 띄운다 — 일곱 프레임이 모두 ±40 ¢ 안에 모여야 한다
    const t2 = createTracker(); const up = (c: number) => 440 * Math.pow(2, c / 1200)
    for (const c of [-150, -120, -90, -60, -30]) expect(t2.push(up(c), 0.95, true, A).midi).toBe(-1)
    for (let k = 1; k <= 5; k++) expect(t2.push(up(0), 0.95, true, A).midi, `0 ¢ frame ${k}: −60 or lower is still in the window`).toBe(-1)
    expect(t2.push(up(0), 0.95, true, A).midi).toBe(69) // 창 = −30 과 0 ¢ 여섯
  })
  test('a vowel-length steady tone (six frames ≈ 0.13 s) shows nothing; one dropped frame is skipped, two restart the count', () => {
    const t = createTracker()
    for (let i = 0; i < 6; i++) expect(t.push(220, 0.95, true, A).midi).toBe(-1)
    expect(t.push(-1, 0, false, A).midi).toBe(-1); expect(t.push(220, 0.95, true, A).midi).toBe(57) // 시끄러운 곳의 한 프레임 빠짐은 건너뛴다
    const u = createTracker()
    for (let i = 0; i < 6; i++) u.push(220, 0.95, true, A)
    u.push(-1, 0, false, A); u.push(-1, 0, false, A); expect(u.push(220, 0.95, true, A).midi).toBe(-1) // 두 프레임 끊기면 처음부터
  })
  test('vibrato ±25 ¢ from the very first frame still acquires on the seventh', () => {
    const t = createTracker(), vib = (k: number) => 440 * Math.pow(2, 25 * Math.sin(2 * Math.PI * 5.5 * k * 1024 / 48000) / 1200)
    for (let k = 0; k < 6; k++) expect(t.push(vib(k), 0.95, true, A).midi).toBe(-1)
    expect(t.push(vib(6), 0.95, true, A).midi).toBe(69)
  })
  test('hysteresis: a momentary ±60¢ jump keeps the note name (the smoothed value is still within half a semitone)', () => {
    const t = acquire(createTracker())
    const up60 = 440 * Math.pow(2, 60 / 1200)
    // 3프레임까지는 평활 때문에 표시값이 +40 ¢ 을 넘지 않는다 → 라벨 유지
    for (let i = 0; i < 3; i++) expect(t.push(up60, 0.95, true, A).midi).toBe(69)
  })
  test('hysteresis: a sustained +60¢ eventually switches to the neighbor (it really is closer)', () => {
    const t = acquire(createTracker())
    const up60 = 440 * Math.pow(2, 60 / 1200)
    let last = 69
    for (let i = 0; i < 12; i++) last = t.push(up60, 0.95, true, A).midi
    expect(last).toBe(70) // 라♯4 −40 ¢ 으로 보이는 게 맞다. '라4 +60 ¢' 는 가장 가까운 음이 아니다
  })
  test('real change switches within 3 frames', () => {
    const t = acquire(createTracker())
    expect(t.push(494, 0.7, true, A).midi).toBe(69) // 중앙값(3)이 아직 이전 음
    expect(t.push(494, 0.7, true, A).midi).toBe(69) // 1st outside frame
    expect(t.push(494, 0.7, true, A).midi).toBe(71) // 2nd → switch to B4 (총 3프레임 ≈ 70 ms)
  })
  test('outlier frame is rejected by weighted median', () => {
    const t = acquire(createTracker())
    const r = t.push(880, 0.6, true, A) // 한 프레임 옥타브 튐
    expect(r.midi).toBe(69); expect(Math.abs(1200 * Math.log2(r.hz / 440))).toBeLessThan(5)
  })
  test('adaptive smoothing: large step converges within a few frames', () => {
    const t = acquire(createTracker())
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
    const t = acquire(createTracker(), 196, 0.2)
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
    const t = acquire(createTracker(), 440, 0.2)
    let prev = -Infinity, back = 0, last = 0
    for (let i = 1; i <= 16; i++) { const o = t.push(440 * Math.pow(2, i * 20 / 1200), 0.95, true, 0.2); if (o.a < prev - 1e-9) back++; prev = o.a; last = o.a } // 20 ¢ 씩 320 ¢ 까지 (라→시 를 지나 도♯ 까지)
    expect(back).toBe(0); expect(last).toBeGreaterThan(250) // 뒤로 간 적 없고, 끝에서 목표(320 ¢) 가까이
  })

  test('after a note change the needle reads the new note at once — no smoothing carried over from the old note', () => {
    // 반음 슬러(미4 +14 → 파4 −11): 평활을 이어 가면 새 음이 −40 ¢ 대에서 0.3 s 에 걸쳐 −11 로 미끄러져 보인다(숫자·초록도 같이)
    const t = createTracker(), hz = (c: number) => 440 * Math.pow(2, c / 1200)
    for (let i = 0; i < 10; i++) t.push(hz(-486), 0.95, true, 0.2)
    const outs = [-461, -436, -411, -411, -411, -411, -411, -411].map(c => t.push(hz(c), 0.95, true, 0.2)) // 창이 두 음에 걸친 두 프레임, 그다음 파4 −11
    const k = outs.findIndex(o => o.midi === 65)
    expect(k).toBeGreaterThanOrEqual(0); expect(outs[k]!.settling).toBe(true)
    for (const o of outs.slice(k + 3)) expect(Math.abs(o.a - -411)).toBeLessThan(0.5)
  })
  test('a label change at half a semitone starts from the median, not from ∓50 ¢', () => {
    const t = acquire(createTracker(), 440, 0.2), hz = (c: number) => 440 * Math.pow(2, c / 1200)
    let first = null as null | ReturnType<typeof t.push>
    for (let i = 0; i < 16 && !first; i++) { const o = t.push(hz(60), 0.95, true, 0.2); if (o.midi === 70) first = o }
    expect(first).not.toBeNull(); expect(Math.abs(first!.a - 60)).toBeLessThan(0.5) // 라♯4 −40 ¢ 에서 시작 (평활값이면 −49 ¢)
  })

  test('inside metronome click windows a different note needs three frames, outside two', () => {
    const settle = () => acquire(createTracker())
    const a = settle(); expect(a.push(659, .95, true, A, true).midi).toBe(69); expect(a.push(659, .95, true, A, true).midi).toBe(69)
    expect(a.push(440, .95, true, A, true).midi).toBe(69) // 클릭이 섞인 두 프레임의 가짜 음은 화면에 안 나온다
    // 중앙값(3)이 새 음으로 넘어간 뒤부터 센다: 평소엔 셋째 프레임, 클릭 구간에선 넷째 프레임에 바뀐다
    const b = settle(); for (let i = 0; i < 3; i++) expect(b.push(659, .95, true, A, true).midi).toBe(69); expect(b.push(659, .95, true, A, true).midi).toBe(76)
    const c = settle(); c.push(659, .95, true, A); c.push(659, .95, true, A); expect(c.push(659, .95, true, A).midi).toBe(76)
  })

  test('held count: +1 per missing frame, 0 on a fresh measurement (so the trace leaves no horizontal line)', () => {
    const t = createTracker()
    for (let i = 0; i < DEFAULT_TRACKER.acquireFrames + 1; i++) expect(t.push(440, 0.95, true, A).held).toBe(0)
    expect(t.push(-1, 0, false, A).held).toBe(1)
    expect(t.push(-1, 0, false, A).held).toBe(2)
    expect(t.push(440, 0.95, true, A).held).toBe(0) // 다시 잡히면 0
  })
})
