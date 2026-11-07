/** 녹음 보관 정책. persist(삭제)와 ui(예고)가 같은 값·같은 함수를 본다 */
const REC_TTL_DAYS = 30
export const REC_TTL = REC_TTL_DAYS * 24 * 60 * 60 * 1000

/** 지금 자동 삭제 대상인가. autoDelete 꺼짐·keep·ts 없는 구버전 행은 지우지 않는다 */
export function expires(ts: number | undefined, keep: boolean | undefined, autoDelete: boolean, now: number): boolean {
  if (!autoDelete || keep || typeof ts !== 'number') return false
  return now - ts > REC_TTL
}

/** 목록에 보일 남은 일수(자동 삭제 대상이 아니면 null). floor 라 24시간 미만은 0 = '오늘'.
 *  2.9.2 까지는 마지막 7일만 보였다 — 자동 삭제가 기본으로 켜져 있는데 그 전엔 알 길이 없어, 몇 주 뒤 찾는 녹음이 이미 없었다(출시 전 점검). 이제 늘 「n일 후 삭제 · 남기기」 */
export function warnDaysLeft(ts: number | undefined, keep: boolean | undefined, autoDelete: boolean, now: number): number | null {
  if (!autoDelete || keep || typeof ts !== 'number') return null
  const d = Math.max(0, Math.floor((ts + REC_TTL - now) / 86400000))
  return d
}

/** 녹음 파일을 통째로 디코드하는 일(구간 WAV 저장 · webm → WAV 변환 · 편집기 배속 재생)의 상한 (s). 10 분 = 48 kHz 스테레오 PCM 약 230 MB
 * (배속 재생은 그 위에 한 채널 115 MB 를 잠깐 더 쓰고 그 채널만 남긴다). 60 분(약 690 MB)은 아이폰 탭이 죽었다 */
export const DECODE_MAX_SEC = 600

/** 재생에 쓸 길이. 녹음 길이(itemDur — 녹음하며 벽시계로 잰 값)를 기준으로, 미디어가 말하는 길이는 그 근처(절반~1.5 배)일 때만 믿는다.
 * Chromium 의 MediaRecorder webm 은 길이를 안 쓰고, 안드로이드 크롬은 그 파일의 길이를 Infinity 가 아니라 엉뚱한 유한값(47 초짜리를 75 시간)으로 보고하기도 한다 — 그러면 슬라이더 끝이 수십 시간이 되어 어디를 눌러도 끝 너머였다 */
export function trustedDuration(itemDur: number, mediaDur: number | undefined): number {
  const base = itemDur > 0 ? itemDur : 0
  if (typeof mediaDur !== 'number' || !isFinite(mediaDur) || mediaDur <= 0) return base
  if (!base) return mediaDur
  return mediaDur >= base * 0.5 && mediaDur <= base * 1.5 ? mediaDur : base
}
