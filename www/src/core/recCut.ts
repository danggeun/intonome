/**
 * 녹음 중 마이크가 막혔다가(트랙 'mute' — 아이폰 웹앱이 화면을 끄거나 전화가 올 때 OS 가 막는다) 풀렸을 때 할 일. 순수.
 * 녹음은 마이크가 실제로 소리를 받는 동안만 한다: 막힌 동안은 멈춰 두고, 잠깐이면 이어 가고, 길면 막힌 시점까지 저장하고 끝낸다.
 */
/** 이보다 짧은 막힘은 이어 녹음 — 블루투스 경로가 바뀌는 순간 같은 끊김. 화면 끄기·전화는 수 초 이상이다 */
export const CUT_MS = 1500
export function afterUnmute(mutedMs: number): 'resume' | 'cut' { return mutedMs < CUT_MS ? 'resume' : 'cut' }
/** 파일 길이(초): 막혀서 끝났으면 막힌 시점까지, 이어 녹음한 짧은 막힘은 뺀다 */
export function recDurSec(t0: number, now: number, mutedAt: number, pausedMs: number): number {
  return Math.max(0, Math.round(((mutedAt || now) - t0 - pausedMs) / 1000))
}
