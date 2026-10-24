/**
 * 메트로놈 클릭의 음높이 — 기준음(A=)의 두 반음 사이 정가운데에 둔다. 튜너는 클릭 구간에서 이 높이(어느 옥타브든)로 읽힌 프레임만 버린다.
 * 연주자가 어떤 음을 ±30 ¢ 안에서 내도 클릭과 50 ¢ 떨어져 있으므로, 클릭이 울리는 순간에도 연주 음은 버려지지 않는다.
 */
export const CLICK_BASE_HZ = { accent: 1800, beat: 1100, sub: 750 } as const
export type ClickKind = keyof typeof CLICK_BASE_HZ
/** 클릭으로 볼 범위 (¢). 클릭과 연주 음이 섞이면 읽힌 높이가 10~18 ¢ 흔들린다(실측) */
export const CLICK_REJECT_CENTS = 20

/** base 에서 가장 가까운 '반음 사이' 높이. refHz 가 이상하면 440 기준 */
export function clickHz(base: number, refHz: number): number {
  const ref = refHz > 0 && isFinite(refHz) ? refHz : 440
  return ref * Math.pow(2, (Math.floor(12 * Math.log2(base / ref)) + 0.5) / 12)
}

/** hz 가 이 기준음의 클릭 음높이(어느 옥타브든) ±CLICK_REJECT_CENTS 안인가 */
export function isClickPitch(hz: number, refHz: number): boolean {
  if (!(hz > 0)) return false
  for (const base of Object.values(CLICK_BASE_HZ)) {
    const d = ((1200 * Math.log2(hz / clickHz(base, refHz))) % 1200 + 1800) % 1200 - 600
    if (Math.abs(d) < CLICK_REJECT_CENTS) return true
  }
  return false
}
