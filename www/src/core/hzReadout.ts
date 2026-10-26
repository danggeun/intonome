/**
 * Hz 읽기표시. 값은 6칸 고정 오른쪽 맞춤(모노스페이스 + white-space:pre 전제).
 * 값은 센트 숫자(차분한 값, core/pitch/readout)가 가리키는 높이 — 숫자가 바뀔 때만 같이 바뀌고, 둘이 늘 같은 높이를 말한다.
 */
export function fmtHz(hz: number): string {
  if (!isFinite(hz) || hz <= 0) return ''
  return hz.toFixed(1).padStart(6, ' ') + ' Hz'
}

/** 화면에 쓸 Hz: 같은 프레임의 hz·cents 로 음 중심을 구하고, 거기서 readCents(화면의 센트 숫자)만큼.
 * 기준음 설정을 읽지 않으므로 A = 드럼을 돌리는 동안에도 숫자와 어긋나지 않는다. 음이 없으면 −1 */
export function calmHz(hz: number, cents: number, readCents: number): number {
  if (!(hz > 0)) return -1
  return hz * Math.pow(2, (readCents - cents) / 1200)
}
