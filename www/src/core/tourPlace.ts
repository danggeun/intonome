/**
 * 처음 안내 말풍선의 자리 — 밝힌 곳(구멍) 아래 → 위 → 옆(넓은 화면의 세로로 긴 메트로놈) → 그래도 없으면 구멍 안(폰의 펼침2 메트로놈).
 * 화면 좌표만 받는 순수 계산. 꼬리(caret)는 말풍선 안에서 구멍 가운데(옆이면 구멍 위쪽)를 가리킨다
 */
export interface Box { left: number; top: number; right: number; bottom: number; width: number; height: number }
export type Place = 'below' | 'above' | 'left' | 'right' | 'none'
export interface PlaceIn {
  /** 구멍. 없으면(마지막 장) 화면 가운데 */
  hole: Box | null
  vw: number; vh: number
  /** 안전 영역(노치·홈 막대) */
  insetTop: number; insetBottom: number
  /** 말풍선 크기 */
  cw: number; ch: number
  /** 아래로 더 띄울 거리 — 첫 장의 × 안내가 밝힌 곳을 가리지 않게 */
  hintGap: number
  /** 해 볼 곳 표시(고리·점)가 떠 있는가 — 구멍 안에 둘 때 그것을 가리지 않게 아래쪽에 */
  hasPulse: boolean
}
/** caret: 옆이면 말풍선 위에서부터의 top, 아니면 왼쪽에서부터의 left (place 'none' 이면 꼬리는 숨는다) */
export interface PlaceOut { x: number; y: number; place: Place; caret: { side: boolean; at: number } }

const M = 12, G = 16, CARET_EDGE = 22

export function placeBubble(o: PlaceIn): PlaceOut {
  const { hole: h, vw, vh, cw, ch } = o
  const top0 = o.insetTop + M, bot0 = vh - o.insetBottom - M
  let x: number, y: number, place: Place = 'below'
  const cx = h ? h.left + h.width / 2 : vw / 2
  const clampY = (v: number): number => Math.max(top0, Math.min(bot0 - ch, v))
  const clampX = (v: number): number => Math.round(Math.max(G, Math.min(vw - G - cw, v)))
  if (!h) { y = vh * 0.5 - ch / 2; x = clampX(vw / 2 - cw / 2); place = 'none' }
  else if (bot0 - (h.bottom + M + o.hintGap) >= ch) { y = h.bottom + M + o.hintGap; x = clampX(cx - cw / 2) }
  else if (h.top - M - top0 >= ch) { y = h.top - M - ch; x = clampX(cx - cw / 2); place = 'above' }
  else if (h.left - M - G >= cw) { y = clampY(h.top); x = Math.round(h.left - M - cw); place = 'left' }
  else if (vw - G - (h.right + M) >= cw) { y = clampY(h.top); x = Math.round(h.right + M); place = 'right' }
  else { y = o.hasPulse ? Math.min(bot0, h.bottom - M) - ch : Math.max(top0, h.top + M); x = clampX(cx - cw / 2); place = 'none' } // 화면을 다 쓰는 메트로놈: 밀 곳(위 헤더)·다이얼을 가리지 않게 아래쪽 안에
  y = Math.round(clampY(y))
  const side = place === 'left' || place === 'right'
  const at = side ? Math.round(Math.max(CARET_EDGE, Math.min(ch - CARET_EDGE, (h!.top + 28) - y))) : Math.round(Math.max(CARET_EDGE, Math.min(cw - CARET_EDGE, cx - x)))
  return { x, y, place, caret: { side, at } }
}
