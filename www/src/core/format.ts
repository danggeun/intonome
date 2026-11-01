/** 정수 초 → "MM:SS" (타이머용, 60분 이상은 분이 두 자리를 넘음) */
export function fmt(s: number): string {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

/** 실수 초 → "MM:SS" (재생 위치용, 비정상 값은 00:00) */
export function fmtT(s: number): string {
  if (!isFinite(s) || isNaN(s) || s < 0) return '00:00'
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0')
}

/** 실수 초 → "MM:SS.d" (A·B 지점용 — ‹ › 가 0.25 초씩 움직여 초 단위로는 바뀐 게 안 보였다). 0.1 초 아래는 버림 */
export function fmtTenths(s: number): string {
  if (!isFinite(s) || isNaN(s) || s < 0) return '00:00.0'
  const d = Math.floor(s * 10 + 1e-6) // 1.2 * 10 = 11.999… 가 11 이 되지 않게
  return fmtT(Math.floor(d / 10)) + '.' + (d % 10)
}

/** 헤더 타이머 칸이 차는 비율: 소리 낸 시간 ÷ 경과 시간 (연습 밀도). 0–1, 경과가 0 이면 0 */
export const playedRatio = (played: number, elapsed: number): number => elapsed > 0 ? Math.min(1, Math.max(0, played / elapsed)) : 0
