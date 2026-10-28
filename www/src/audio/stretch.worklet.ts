/**
 * 편집기 배속 재생 AudioWorkletProcessor — core/stretch(WSOLA)를 오디오 스레드에서 돌린다. 모노 출력.
 * 메시지(메인 → 여기): load(소스) · play(위치) · pause · seek(위치) · rate · free. 보고(여기 → 메인): pos(소스 위치, 그때의 컨텍스트 시각) · ended.
 * 위치 보고에는 seek 세대(gen)를 붙인다 — 메인이 옮긴 뒤에 도착한 옛 보고를 버릴 수 있게.
 */
import { createStretcher, type Stretcher } from '../core/stretch.ts'

declare const sampleRate: number
declare const currentTime: number
declare function registerProcessor(name: string, ctor: unknown): void
declare class AudioWorkletProcessor { readonly port: MessagePort; constructor() }

/** 위치 보고 간격 ≈ 0.1 s */
const REPORT_BLOCKS = Math.max(1, Math.round(0.1 * sampleRate / 128))

class StretchProcessor extends AudioWorkletProcessor {
  private st: Stretcher | null = null
  private playing = false
  private gen = 0
  private blocks = 0
  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'load') { this.st = createStretcher(m.data as Float32Array, sampleRate, m.rate as number); this.playing = false }
      else if (m.type === 'free') { this.st = null; this.playing = false }
      else if (!this.st) return
      else if (m.type === 'rate') this.st.rate = m.rate as number
      else if (m.type === 'seek') { this.gen = m.gen as number; this.st.seek(Math.round((m.at as number) * sampleRate), this.playing); this.report() }
      else if (m.type === 'play') {
        this.gen = m.gen as number
        // 멈춘 자리 그대로면 이어서(계산해 둔 반 프레임부터), 다른 자리면 새로 시작(옛 소리 없이 올라옴)
        const at = Math.round((m.at as number) * sampleRate)
        if (Math.abs(at - this.st.position) > sampleRate * 0.002 || this.st.ended) this.st.seek(at, false)
        this.playing = true; this.blocks = 0; this.report()
      } else if (m.type === 'pause') { this.playing = false; this.report() }
    }
  }
  /** t = 다음에 나갈 샘플의 컨텍스트 시각 */
  private report(t = currentTime): void { if (this.st) this.port.postMessage({ type: 'pos', pos: this.st.position / sampleRate, t, gen: this.gen }) }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]?.[0]; if (!out) return true
    if (!this.playing || !this.st) { out.fill(0); return true }
    const n = this.st.render(out)
    if (n < out.length && this.st.ended) { this.playing = false; this.port.postMessage({ type: 'ended', gen: this.gen }); return true }
    if (++this.blocks % REPORT_BLOCKS === 0) this.report(currentTime + out.length / sampleRate)
    return true
  }
}
registerProcessor('gp-stretch', StretchProcessor)
