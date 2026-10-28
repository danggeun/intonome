/** 녹음을 모노로 — 살아 있는 채널 하나를 고른다. 아이폰은 모노 마이크를 '2채널, 둘째는 무음' 으로 녹음한다(WebKit 259193). 순수 */

/** 가장 큰(에너지) 채널의 번호. 길이가 길어도 빠르게 — 16 샘플마다 본다 */
export function loudestChannel(chs: ArrayLike<number>[]): number {
  let best = 0, bestE = -1
  chs.forEach((x, c) => { let e = 0; for (let i = 0; i < x.length; i += 16) e += x[i]! * x[i]!; if (e > bestE) { bestE = e; best = c } })
  return best
}
