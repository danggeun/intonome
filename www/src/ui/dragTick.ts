/** 끌어서 값을 바꿀 때 한 칸마다 짧은 진동: 메트로놈 다이얼 · BPM 숫자 끌기 · 기준음(A =) 드럼 */
import { sessionStore, settingsStore } from '../state/index.ts'
import { vibrateTick } from '../platform/index.ts'

/** prev → next 사이(prev 는 빼고 next 까지)에 10 단위(80, 90 … · 440, 450 …)가 있는가. 올릴 때도 내릴 때도 그 칸에 닿는 순간 */
export const reachesTen = (prev: number, next: number): boolean =>
  next > prev ? Math.floor(next / 10) > Math.floor(prev / 10) : Math.floor((prev - 1) / 10) > Math.floor((next - 1) / 10)

/** 값이 prev → next 로 바뀌었으면 톡, 10 단위에 닿으면 조금 세게. 설정 › 진동이 꺼져 있거나 녹음 중(마이크가 진동음을 듣는다)이면 없다 */
export function dragTick(prev: number, next: number): void {
  if (prev === next || !settingsStore.get().haptics || sessionStore.get().recording) return
  vibrateTick(reachesTen(prev, next))
}
