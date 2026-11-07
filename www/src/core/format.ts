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

/** 녹음 이름의 날짜(월·일). 숫자만 쓰는 「11/7」 은 한국어·일본어에선 11월 7일이지만, 영국식 영어·스페인어·홍콩·싱가포르에선 7월 11일로 읽힌다 →
 *  영어·스페인어는 달 이름(「Nov 7」 「7 nov」), 중국어는 「11月7日」, 한국어·일본어는 그대로 「11/7」 */
export function fmtMonthDay(month: number, day: number, lang: string): string {
  if (lang === 'zh-Hans' || lang === 'zh-Hant') return `${month}月${day}日`
  if (lang === 'en' || lang === 'es') {
    try {
      // 해는 상관없다(달 이름만) — 2001 은 아무 해나 고른 것
      return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2001, month - 1, day))).replace(/\.$/, '')
    } catch { /* Intl 이 없는 옛 환경 — 아래 숫자 형식 */ }
  }
  return `${month}/${day}`
}
