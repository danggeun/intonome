/**
 * 편집기의 시간 계산 — 트랙 창(전체 / A-B 확대), A·B 지점 범위, 반복 시작점, 재생 속도. 순수
 */
export interface TimeWindow { t0: number; t1: number }
/** A·B 사이 최소 간격 (s) */
const AB_MIN_GAP = 0.1
/** 확대 창은 [A − 2 s, B + 2 s] */
const ZOOM_PAD = 2
/** 반복 '1 s 앞' 의 프리롤 (s) */
const PREROLL_SEC = 1
const SPEED_MIN = 0.5, SPEED_MAX = 1.5
/** 값 라벨 탭 순환: 1.0 → 0.5 → 0.7 → 0.85 → 1.0 (활 든 손으로 슬라이더 대신 한 번씩 탭) */
const SPEED_PRESETS = [1.0, 0.5, 0.7, 0.85] as const

/** 보이는 창 — 확대가 없거나 깨졌으면 전체(길이를 모르면 0..1) */
export function viewRange(view: TimeWindow | null, dur: number): TimeWindow { return view && view.t1 > view.t0 ? view : { t0: 0, t1: dur || 1 } }
/** 시간 → 0..1 (창 밖은 가장자리에 붙음) */
export function frac(t: number, r: TimeWindow): number { return Math.max(0, Math.min(1, (t - r.t0) / (r.t1 - r.t0))) }
/** 0..1 → 시간 */
export function timeAt(f: number, r: TimeWindow): number { return r.t0 + Math.max(0, Math.min(1, f)) * (r.t1 - r.t0) }
/** A-B 확대 창. 길이·A·B 중 하나라도 없으면 null(전체) */
export function zoomWindow(a: number | null, b: number | null, dur: number): TimeWindow | null {
  return a !== null && b !== null && dur ? { t0: Math.max(0, a - ZOOM_PAD), t1: Math.min(dur, b + ZOOM_PAD) } : null
}
/** A 를 옮길 수 있는 자리: 0 이상, B 보다 0.1 s 앞(B 가 없으면 끝까지) */
export function clampA(t: number, b: number | null, dur: number): number { return Math.max(0, Math.min(b !== null ? b - AB_MIN_GAP : dur, t)) }
/** B 를 옮길 수 있는 자리: A 보다 0.1 s 뒤(A 가 없으면 0부터), 끝 이하 */
export function clampB(t: number, a: number | null, dur: number): number { return Math.max(a !== null ? a + AB_MIN_GAP : 0, Math.min(dur, t)) }
/** 반복 시작점: 0 = 꺼짐 · 1 = A 부터 · 2 = A 1 s 앞부터(0 아래로는 안 감) */
export function loopStart(a: number | null, loop: 0 | 1 | 2): number { return a === null ? 0 : (loop === 2 ? Math.max(0, a - PREROLL_SEC) : a) }
/** 슬라이더·저장값 → 재생 속도 (0.01 단위, 0.5~1.5) */
export function clampSpeed(v: number): number { return Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(v * 100) / 100)) }
/** 속도 라벨: 0.1 단위면 한 자리('0.5×'), 아니면 두 자리('0.85×') */
export function speedLabel(v: number): string { return (Number.isInteger(v * 10) ? v.toFixed(1) : v.toFixed(2)) + '×' }
/** 다음 프리셋 — 프리셋이 아닌 값(슬라이더로 맞춘 0.75 등)에서는 1.0 으로 */
export function nextPreset(cur: number): number {
  const i = SPEED_PRESETS.findIndex(p => Math.abs(p - cur) < 0.01)
  return SPEED_PRESETS[(i + 1) % SPEED_PRESETS.length]!
}
