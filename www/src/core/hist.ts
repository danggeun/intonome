/** 트레이스 히스토리 길이(초 → 프레임 수). 프레임률 = sampleRate / hop (44.1 k 43.1 fps, 48 k 46.9 fps) */
export function histLenFor(sampleRate: number, sec: number, hop = 1024): number {
  const sr = isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 44100
  return Math.max(8, Math.round(sec * sr / hop))
}

/** 프레임 한 줄의 최소 높이(CSS px). 보이는 높이가 이보다 좁게 나누면 최근 것만 그린다 — 작은 아이폰(375×667)에서 메트로놈을 펼치면
 * 4 초가 약 100 px 에 눌려 비브라토가 납작한 용수철이 됐다. 390×844 의 펼침(≈ 1.6 px)·접힘에는 걸리지 않는다 */
export const MIN_ROW_PX = 1.25
/** 보이는 높이 h(CSS px)에 그릴 최근 프레임 수 (n 이하) */
export function rowsShown(n: number, h: number): number { return Math.min(n, Math.max(2, Math.floor(h / MIN_ROW_PX))) }
