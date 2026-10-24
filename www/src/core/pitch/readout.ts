/**
 * 사람이 읽는 값(cents 숫자와 '맞음' 초록) — 선(트레이스)과 음이름은 매 프레임 그대로 빠르게 두고, 숫자만 차분하게.
 * 같은 음의 최근 windowFrames 평균을 보여 주되, 평균이 deadband 넘게 움직일 때만 숫자를 바꾼다(비브라토·손 떨림에 숫자가 초당 수십 번 바뀌지 않게).
 * 한쪽으로 trendFrames 연속 trendCents 넘게 벗어나면(줄감개를 돌리는 중) 평균을 끊고 그 자리로 옮긴다. 비브라토는 양쪽을 오가서 이 조건에 안 걸린다.
 * 초록은 이 숫자로 정한다 — 숫자와 색이 늘 일치한다.
 */
export interface ReadoutParams { windowFrames: number; deadband: number; trendFrames: number; trendCents: number }
export interface Readout {
  /** @param midi 표시 음 (-1 없음) @param cents 표시 cents (반올림 전) @param fresh 새 측정이면 true, 유지(held) 프레임이면 false. 숫자를 돌려준다 (음이 없으면 0) */
  push(midi: number, cents: number, fresh: boolean): number
  reset(): void
}
export function createReadout(p: ReadoutParams): Readout {
  const buf: number[] = []; let midi = -1, shown = 0
  const reset = (): void => { buf.length = 0; midi = -1; shown = 0 }
  const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
  return {
    reset,
    push(m, cents, fresh) {
      if (m < 0) { reset(); return 0 }
      if (m !== midi) { buf.length = 0; midi = m; shown = Math.round(cents) } // 새 음: 평균을 버리고 바로
      if (fresh) { buf.push(cents); if (buf.length > p.windowFrames) buf.shift() }
      if (buf.length >= p.trendFrames) {
        const last = buf.slice(-p.trendFrames), side = Math.sign(last[0]! - shown)
        if (side !== 0 && last.every(v => Math.sign(v - shown) === side && Math.abs(v - shown) > p.trendCents)) {
          buf.splice(0, buf.length - p.trendFrames) // 이전 자리의 값은 평균에서 뺀다
          shown = Math.round(mean(last))
        }
      }
      const mm = buf.length ? mean(buf) : cents
      if (Math.abs(mm - shown) >= p.deadband) shown = Math.round(mm)
      return shown
    },
  }
}
