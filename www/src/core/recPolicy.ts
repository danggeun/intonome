/** 녹음 보관 정책. persist(삭제)와 ui(예고)가 같은 값·같은 함수를 본다 */
const REC_TTL_DAYS = 30
export const REC_TTL = REC_TTL_DAYS * 24 * 60 * 60 * 1000
/** 삭제 예고를 보이기 시작하는 남은 일수 */
const REC_WARN_DAYS = 7

/** 지금 자동 삭제 대상인가. autoDelete 꺼짐·keep·ts 없는 구버전 행은 지우지 않는다 */
export function expires(ts: number | undefined, keep: boolean | undefined, autoDelete: boolean, now: number): boolean {
  if (!autoDelete || keep || typeof ts !== 'number') return false
  return now - ts > REC_TTL
}

/** 삭제 예고에 쓸 남은 일수. 마지막 REC_WARN_DAYS 일이 아니면 null. floor 라 24시간 미만은 0 = '오늘' */
export function warnDaysLeft(ts: number | undefined, keep: boolean | undefined, autoDelete: boolean, now: number): number | null {
  if (!autoDelete || keep || typeof ts !== 'number') return null
  const d = Math.max(0, Math.floor((ts + REC_TTL - now) / 86400000))
  return d < REC_WARN_DAYS ? d : null
}

/** 녹음 파일을 통째로 디코드하는 일(구간 WAV 저장 · webm → WAV 변환 · 편집기 배속 재생)의 상한 (s). 10 분 = 48 kHz 스테레오 PCM 약 230 MB
 * (배속 재생은 그 위에 한 채널 115 MB 를 잠깐 더 쓰고 그 채널만 남긴다). 60 분(약 690 MB)은 아이폰 탭이 죽었다 */
export const DECODE_MAX_SEC = 600
