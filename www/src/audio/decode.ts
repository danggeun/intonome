/** 녹음 파일 → 모노 PCM. 살아 있는 채널 하나(core/mono)를 sampleRate 로 디코드해 복사한다 — 원래 버퍼(채널 전부)는 바로 놓아준다 */
import { loudestChannel } from '../core/mono.ts'

/** @param fromSec·toSec 이 구간만 복사(구간 WAV 저장) — 없으면 전체 */
export async function decodeMono(url: string, sampleRate: number, fromSec = 0, toSec = Infinity): Promise<Float32Array<ArrayBuffer>> {
  const data = await (await fetch(url)).arrayBuffer()
  const d = await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(data) // 디코드만 — 실시간 컨텍스트를 새로 만들지 않는다
  const chs = Array.from({ length: d.numberOfChannels }, (_, c) => d.getChannelData(c))
  const s0 = Math.max(0, Math.floor(fromSec * d.sampleRate)), s1 = Math.min(d.length, Math.floor(toSec * d.sampleRate))
  return chs[loudestChannel(chs)]!.slice(s0, Math.max(s0, s1))
}
