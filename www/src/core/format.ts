/** 정수 초 → "MM:SS" (타이머용, 60분 이상은 분이 두 자리를 넘음) */
export function fmt(s: number): string {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

/** 실수 초 → "MM:SS" (재생 위치용, 비정상 값은 00:00) */
export function fmtT(s: number): string {
  if (!isFinite(s) || isNaN(s) || s < 0) return '00:00'
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0')
}

/** 헤더 타이머 칸이 차는 비율: 소리 낸 시간 ÷ 경과 시간 (연습 밀도). 0–1, 경과가 0 이면 0 */
export const playedRatio = (played: number, elapsed: number): number => elapsed > 0 ? Math.min(1, Math.max(0, played / elapsed)) : 0
