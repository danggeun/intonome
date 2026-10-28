/**
 * 편집기 배속 재생 AudioWorkletProcessor — core/stretch(WSOLA)를 오디오 스레드에서 돌린다. 모노 출력.
 * 메시지(메인 → 여기): load(소스) · play(위치) · pause · seek(위치, 재생 중인가) · rate · free. 보고(여기 → 메인): pos(소스 위치, 그 샘플의 컨텍스트 시각) · ended.
 * 위치 보고에는 seek 세대(gen)를 붙인다 — 메인이 옮긴 뒤에 도착한 옛 보고를 버릴 수 있게.
 * seek 는 메인이 아는 '재생 중' 을 함께 보낸다: 끝에 닿아 여기서 멈춘 직후 메인이 (ended 를 받기 전에) 옮기면 그 ended 는 옛 세대로 버려지므로, 여기서 다시 재생을 이어야 한다.
 * 멈춤·이어 재생은 한 블록(2.7 ms)에 걸쳐 내리고 올린다 — 파형 중간에서 끊으면 딸깍 소리가 난다.
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
  private fadeIn = false
  private fadeOut = false
  /** 멈춘 채 옮길 자리 — 내리는 블록이 끝난 뒤 적용 */
  private afterFade: number | null = null
  private freed = false
  private gen = 0
  private blocks = 0
  constructor() {
    super()
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data
      if (m.type === 'load') { this.st = createStretcher(m.data as Float32Array, sampleRate, m.rate as number); this.playing = false }
      else if (m.type === 'free') { this.st = null; this.playing = false; this.freed = true }
      else if (!this.st) return
      else if (m.type === 'rate') this.st.rate = m.rate as number
      else if (m.type === 'seek') {
        this.gen = m.gen as number
        const at = Math.round((m.at as number) * sampleRate)
        if (m.play) this.resume(at, true)
        else if (this.playing) { this.fadeOut = true; this.afterFade = at } // 내리는 블록을 마친 뒤 옮긴다
        else this.st.seek(at, false)
        this.report(currentTime, this.afterFade ?? undefined)
      } else if (m.type === 'play') {
        this.gen = m.gen as number
        this.resume(Math.round((m.at as number) * sampleRate), false); this.report()
      } else if (m.type === 'pause') { if (this.playing) this.fadeOut = true }
    }
  }
  /** 소리를 (다시) 낸다. 아직 소리가 나는 중이면(내리기 전) 끊지 않고 이어 가며, 다른 자리면 교차 페이드.
   * 멈춰 있었으면 다른 자리·끝은 새로 시작(옛 소리 없이 반 창 동안 올라옴), 같은 자리면 계산해 둔 반 프레임부터 한 블록 동안 올림 */
  private resume(at: number, jump: boolean): void {
    const st = this.st!, elsewhere = jump || Math.abs(at - st.position) > sampleRate * 0.002 || st.ended
    if (this.playing) { if (elsewhere) st.seek(at, true); this.fadeOut = false; this.afterFade = null; return }
    if (elsewhere) st.seek(at, false)
    this.fadeIn = true; this.playing = true; this.blocks = 0
  }
  /** t = 다음에 나갈 샘플의 컨텍스트 시각. at = 보고할 자리(옮기기를 미뤄 둔 동안은 그 자리) */
  private report(t = currentTime, at = this.st?.position ?? 0): void { if (this.st) this.port.postMessage({ type: 'pos', pos: at / sampleRate, t, gen: this.gen }) }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.freed) return false // 버린 노드는 더 돌지 않는다(가비지 컬렉션되게)
    const out = outputs[0]?.[0]; if (!out) return true
    if (!this.playing || !this.st) { out.fill(0); return true }
    const n = this.st.render(out), L = out.length
    if (this.fadeIn) { for (let i = 0; i < L; i++) out[i]! *= i / L; this.fadeIn = false }
    if (n < L && this.st.ended) { this.playing = false; this.fadeOut = false; this.afterFade = null; this.port.postMessage({ type: 'ended', gen: this.gen }); return true }
    if (this.fadeOut) {
      for (let i = 0; i < L; i++) out[i]! *= 1 - i / L
      this.fadeOut = false; this.playing = false
      if (this.afterFade !== null) { this.st.seek(this.afterFade, false); this.afterFade = null }
      this.report(currentTime + L / sampleRate); return true
    }
    if (++this.blocks % REPORT_BLOCKS === 0) this.report(currentTime + L / sampleRate)
    return true
  }
}
registerProcessor('gp-stretch', StretchProcessor)
