import { describe, test, expect } from 'vitest'
import { createStretcher } from './stretch.ts'

const SR = 48000
const sine = (hz: number, sec: number, amp = 0.5): Float32Array => Float32Array.from({ length: Math.round(sec * SR) }, (_, i) => amp * Math.sin(2 * Math.PI * hz * i / SR))
/** 끝까지 128 샘플 블록으로 뽑는다 (오디오 스레드와 같은 크기) */
function renderAll(st: ReturnType<typeof createStretcher>, maxSec = 20): Float32Array {
  const out: number[] = [], blk = new Float32Array(128)
  while (!st.ended && out.length < maxSec * SR) { const k = st.render(blk); for (let i = 0; i < k; i++) out.push(blk[i]!) }
  return Float32Array.from(out)
}
const rms = (x: Float32Array): number => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
/** 오르는 영점 사이 평균 간격으로 잰 주파수 */
function freq(x: Float32Array): number {
  const ups: number[] = []
  for (let i = 1; i < x.length; i++) if (x[i - 1]! < 0 && x[i]! >= 0) ups.push(i - x[i]! / (x[i]! - x[i - 1]!))
  return SR * (ups.length - 1) / (ups[ups.length - 1]! - ups[0]!)
}
const maxStep = (x: Float32Array): number => { let m = 0; for (let i = 1; i < x.length; i++) m = Math.max(m, Math.abs(x[i]! - x[i - 1]!)); return m }
const mid = (x: Float32Array): Float32Array => x.subarray(Math.round(x.length * 0.2), Math.round(x.length * 0.8))

describe('time stretch keeps pitch and level', () => {
  for (const rate of [0.5, 0.7, 0.85, 1.25, 1.5]) test(`${rate}×: length ×${(1 / rate).toFixed(2)}, 440 Hz stays 440 Hz, same level, no clicks`, () => {
    const src = sine(440, 3), out = renderAll(createStretcher(src, SR, rate))
    expect(out.length / SR).toBeCloseTo(3 / rate, 1)
    const cents = 1200 * Math.log2(freq(mid(out)) / 440)
    expect(Math.abs(cents)).toBeLessThan(1)
    expect(rms(mid(out)) / rms(src)).toBeGreaterThan(0.97); expect(rms(mid(out)) / rms(src)).toBeLessThan(1.03)
    expect(maxStep(mid(out))).toBeLessThan(maxStep(src) * 1.1) // 프레임 이음새에서 튀지 않는다
  })
  test('a chord (several partials) keeps its level too', () => {
    const a = sine(196, 3, 0.2), b = sine(293.66, 3, 0.2), c = sine(587.33, 3, 0.1)
    const src = a.map((v, i) => v + b[i]! + c[i]!)
    const out = renderAll(createStretcher(src, SR, 0.5))
    expect(rms(mid(out)) / rms(src)).toBeGreaterThan(0.9); expect(rms(mid(out)) / rms(src)).toBeLessThan(1.1)
  })
})

describe('position, speed changes and jumps', () => {
  test('position follows the source at the chosen speed', () => {
    const st = createStretcher(sine(440, 5), SR, 0.5), blk = new Float32Array(128)
    for (let i = 0; i < SR / 128; i++) st.render(blk) // 1 s of output
    expect(st.position / SR).toBeCloseTo(0.5, 1)
    st.rate = 1.5
    for (let i = 0; i < SR / 128; i++) st.render(blk)
    expect(st.position / SR).toBeCloseTo(2.0, 1)
  })
  test('position never goes backwards while playing (a clock the editor can draw); a NaN jump is ignored', () => {
    const st = createStretcher(sine(440, 3), SR, 0.7), blk = new Float32Array(128)
    let last = -1
    for (let i = 0; i < 400; i++) { st.render(blk); expect(st.position).toBeGreaterThanOrEqual(last); last = st.position }
    st.seek(NaN); st.render(blk); expect(Number.isFinite(st.position)).toBe(true); expect(blk.every(Number.isFinite)).toBe(true)
  })
  test('a jump while playing cross-fades: no click, continues from the new place', () => {
    const src = sine(440, 4), st = createStretcher(src, SR, 0.7), blk = new Float32Array(128), out: number[] = []
    for (let i = 0; i < 100; i++) { st.render(blk); out.push(...blk) }
    st.seek(Math.round(2.5 * SR) + 37) // 다른 위상으로
    for (let i = 0; i < 100; i++) { st.render(blk); out.push(...blk) }
    expect(maxStep(Float32Array.from(out).subarray(2048))).toBeLessThan(maxStep(src) * 1.1)
    expect(st.position / SR).toBeGreaterThan(2.5); expect(st.position / SR).toBeLessThan(2.7)
  })
  test('a fresh start drops the old sound and fades in', () => {
    const st = createStretcher(sine(440, 4), SR, 0.5), blk = new Float32Array(128)
    for (let i = 0; i < 50; i++) st.render(blk)
    st.seek(SR, false); st.render(blk)
    expect(Math.abs(blk[0]!)).toBeLessThan(0.001) // 올라오는 반창의 시작
  })
  test('the end: fewer samples than asked, the rest silent, then ended', () => {
    const st = createStretcher(sine(440, 0.5), SR, 0.5), out = renderAll(st)
    expect(st.ended).toBe(true)
    expect(out.length / SR).toBeGreaterThan(0.9); expect(out.length / SR).toBeLessThan(1.01)
    const blk = new Float32Array(128).fill(1)
    expect(st.render(blk)).toBe(0); expect(blk.every(v => v === 0)).toBe(true)
  })
  test('44.1 kHz works the same (window and search are set in time)', () => {
    const src = Float32Array.from({ length: 44100 * 2 }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 330 * i / 44100))
    const st = createStretcher(src, 44100, 0.5), out: number[] = [], blk = new Float32Array(128)
    while (!st.ended) { const k = st.render(blk); for (let i = 0; i < k; i++) out.push(blk[i]!) }
    expect(out.length / 44100).toBeGreaterThan(3.9); expect(out.length / 44100).toBeLessThanOrEqual(4) // 끝의 반 창(≈ 21 ms)은 꼬리로 사라진다
    const x = Float32Array.from(out).subarray(44100, 3 * 44100)
    let ups = 0; for (let i = 1; i < x.length; i++) if (x[i - 1]! < 0 && x[i]! >= 0) ups++
    expect(ups / 2).toBeCloseTo(330, -0.5)
  })
})
