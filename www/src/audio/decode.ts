/** 녹음 파일 디코드. 한 번에 하나씩 — 편집기를 열 때의 배속 준비 · 구간 WAV 저장 · 옛 녹음의 파형이 겹치면 10 분 녹음에서 수백 MB 가 겹친다 */
import { loudestChannel } from '../core/mono.ts'

let chain: Promise<unknown> = Promise.resolve()
/** 앞의 디코드가 끝난 뒤에 job 을 돌린다(실패해도 다음은 돈다) */
export function oneAtATime<T>(job: () => Promise<T>): Promise<T> { const r = chain.then(job, job); chain = r.catch(() => {}); return r }

/** 모노 PCM — 살아 있는 채널 하나(core/mono)를 sampleRate 로 디코드해 복사한다. 원래 버퍼(채널 전부)는 바로 놓아준다
 * @param fromSec·toSec 이 구간만 복사(구간 WAV 저장) @param cancelled 차례가 왔을 때 true 면 디코드하지 않는다 */
export function decodeMono(url: string, sampleRate: number, fromSec = 0, toSec = Infinity, cancelled?: () => boolean): Promise<Float32Array<ArrayBuffer>> {
  return oneAtATime(async () => {
    if (cancelled?.()) throw new Error('cancelled')
    const data = await (await fetch(url)).arrayBuffer()
    const d = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(data) // 디코드만 — 실시간 컨텍스트를 새로 만들지 않는다
    const chs = Array.from({ length: d.numberOfChannels }, (_, c) => d.getChannelData(c))
    const s0 = Math.max(0, Math.floor(fromSec * d.sampleRate)), s1 = Math.min(d.length, Math.floor(toSec * d.sampleRate))
    return chs[loudestChannel(chs)]!.slice(s0, Math.max(s0, s1))
  })
}
