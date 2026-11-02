/** BPM 끌기: 손가락 속도에 따라 1 BPM 에 필요한 거리가 바뀐다 — 천천히는 정밀하게, 휙 끌면 크게.
 * 2.7.2 까지는 늘 2 px = 1 BPM 이라 원하는 숫자에서 손을 떼는 순간 손가락이 조금만 굴러도 1~2 씩 바뀌었다(피드백).
 * 같은 입력(위치·시각 순서)이면 늘 같은 결과 — 상태는 끌기 한 번 안에서만 */

export const PX_SLOW = 6   // 천천히(≤ V_SLOW): 1 BPM = 6 px
export const PX_FAST = 2   // 빠르게(≥ V_FAST): 1 BPM = 2 px (2.7.2 까지의 값)
export const V_SLOW = 0.25 // px/ms
export const V_FAST = 1.2  // px/ms

/** 이 속도(px/ms)에서 1 BPM 에 필요한 px — 사이는 직선으로 잇는다 */
export function pxPerBpm(v: number): number {
  if (v <= V_SLOW) return PX_SLOW
  if (v >= V_FAST) return PX_FAST
  return PX_SLOW + (PX_FAST - PX_SLOW) * (v - V_SLOW) / (V_FAST - V_SLOW)
}

/** 끌기 한 번. start = 시작 BPM, y0·t0 = 시작 위치(위로 갈수록 작은 y)·시각(ms). move 가 새 BPM 을 돌려준다 */
export function createBpmDrag(start: number, min: number, max: number, y0: number, t0: number): { move(y: number, t: number): number } {
  let acc = 0, lastY = y0, lastT = t0
  return {
    move(y, t) {
      const dy = lastY - y, dt = Math.max(1, t - lastT) // 같은 시각에 두 번 와도 0 으로 나누지 않게
      lastY = y; lastT = t
      acc += dy / pxPerBpm(Math.abs(dy) / dt)
      acc = Math.max(min - start, Math.min(max - start, acc)) // 끝에서 멈춘다 — 넘겨 끈 만큼을 되돌릴 필요가 없다
      return start + Math.round(acc)
    },
  }
}
