/** 분석 워커 — 워클릿 청크를 링버퍼에 쌓고, 청크마다(hop 1024) 최신 창(4096)을 분석기에 넣어 프레임을 메인에 보낸다. 알고리즘은 core/ */
import { createAnalyzer, type Analyzer } from '../core/pitch/analyzer.ts'
import { createArrival } from '../core/metro/arrival.ts'
import { createToneFilter, createToneProbe, rms, onlyTone, TONE_SETTLE_S, TONE_TAIL_S, type ToneFilter, type ToneProbe } from '../core/drone.ts'
import type { WorkerIn, WorkerOut, ChunkMsg, RecycleMsg } from './messages.ts'

const WINDOW = 4096
let analyzer: Analyzer | null = null
let sr = 44100
const ring = new Float32Array(WINDOW * 4)
let ringPos = 0, filled = 0
const win = new Float32Array(WINDOW)
let dropBefore = -1
let port: MessagePort | null = null
const mutes: Array<{ from: number; until: number }> = []
const arrival = createArrival() // 클릭 도착 시각 자가 보정
const BLK = 256 // 차분 에너지 블록 (≈5 ms @48k) — 클릭 어택 스파이크를 찾는 해상도
let minOffset = Infinity // 벽시계 − 오디오시계 의 최소값(기준선). 지연이 커지면 이보다 커진다
let skipped = 0
// 앱 음(드론 · A 듣기) 잘라내기: 링에는 앱 음을 뺀 소리가, removedRing 에는 빠진 소리가, rawRing 에는 원래 소리가 쌓인다
const removedRing = new Float32Array(ring.length)
const removedWin = new Float32Array(WINDOW)
const rawRing = new Float32Array(ring.length)
const rawWin = new Float32Array(WINDOW)
const silent = new Float32Array(WINDOW)
let tone: ToneFilter | null = null
let probe: ToneProbe | null = null // 앱 음이 마이크에 들리는지 (이어폰이면 잘라내지 않는다)
let toneHoldUntil = -1, toneOffAt = Infinity
let lastT = 0 // 마지막 청크 끝 시각(초)
let chunkOut = new Float32Array(0), chunkRem = new Float32Array(0)

const post = (m: WorkerOut, transfer?: Transferable[]) => (self as unknown as Worker).postMessage(m, transfer ?? [])

function onChunk(e: MessageEvent<ChunkMsg>): void {
  const m = e.data; if (!m || m.type !== 'chunk' || !analyzer) return
  const c = m.chunk
  const recycle = () => { const buf = c.buffer as ArrayBuffer; port?.postMessage({ type: 'recycle', buf } satisfies RecycleMsg, [buf]) }
  if (m.t < dropBefore) { recycle(); return }
  lastT = m.t
  // 클릭 도착 탐지용 차분 에너지 — 청크 경계의 직전 샘플은 링 끝에서 가져온다
  { let prev = filled > 0 ? ring[(ringPos - 1 + ring.length) % ring.length]! : 0
    for (let b = 0; b < c.length; b += BLK) { let e = 0; const n = Math.min(BLK, c.length - b)
      for (let i = 0; i < n; i++) { const v = c[b + i]!; const d = v - prev; e += d * d; prev = v }
      arrival.pushEnergy(m.t - (c.length - b - n) / sr, e / n) } }
  if (tone && m.t > toneOffAt) { tone = null; probe = null; toneOffAt = Infinity } // 끈 앱 음의 꼬리까지 지나갔다
  if (tone) {
    if (chunkOut.length !== c.length) { chunkOut = new Float32Array(c.length); chunkRem = new Float32Array(c.length) }
    tone.process(c, chunkOut, chunkRem)
    for (let i = 0; i < c.length; i++) { ring[ringPos] = chunkOut[i]!; removedRing[ringPos] = chunkRem[i]!; rawRing[ringPos] = c[i]!; ringPos = (ringPos + 1) % ring.length }
  } else for (let i = 0; i < c.length; i++) { ring[ringPos] = c[i]!; removedRing[ringPos] = 0; rawRing[ringPos] = c[i]!; ringPos = (ringPos + 1) % ring.length }
  filled = Math.min(ring.length, filled + c.length)
  recycle()
  if (filled < WINDOW) return
  // 백프레셔: 도착 지연이 기준선보다 100 ms 이상 크면 분석을 건너뛰고 링만 채운다
  const offset = performance.now() - m.t * 1000
  if (offset < minOffset) minOffset = offset
  else minOffset += 0.5 // 기준선은 천천히 따라 올라간다 (시계 드리프트)
  if (offset - minOffset > 100) { skipped++; return }
  // 창이 클릭 구간과 겹치면 muted 로 분석 — 버리면 120 bpm 세분에서 튜너가 얼어붙는다
  const t0 = m.t - WINDOW / sr
  arrival.update(m.t); const off = arrival.offset() // 실제 도착이 예상보다 늦은 만큼 구간을 민다 (합의 전 0)
  let muted = false
  for (let i = mutes.length - 1; i >= 0; i--) { const r = mutes[i]!; if (r.until + off < t0 - 1) mutes.splice(i, 1); else if (t0 < r.until + off && m.t > r.from + off) muted = true }
  // 최신 WINDOW 샘플을 선형 버퍼로
  let src = (ringPos - WINDOW + ring.length) % ring.length
  for (let i = 0; i < WINDOW; i++) { win[i] = ring[src]!; removedWin[i] = removedRing[src]!; rawWin[i] = rawRing[src]!; src = (src + 1) % ring.length }
  const t0w = performance.now()
  // 앱 음이 켜져 있으면: 마이크에 안 들리면(이어폰) 원래 소리를 그대로 읽는다. 들리면 필터가 자리 잡는 동안, 그리고 남은 소리가 앱 음의 찌꺼기뿐이면 무음으로 분석 (튜너 '--', 연주 시간도 안 센다)
  let input: Float32Array = win
  if (tone && probe) {
    const holding = t0 < toneHoldUntil, was = probe.bypass
    const bypass = !holding && probe.frame(rawWin, Math.round(m.t * sr) - WINDOW, analyzer.getSettings().rmsMin)
    if (was && !bypass) analyzer.reset() // 이어폰을 뺐다: 방금까지 보이던 음은 앱 음이었다 — 유지 시간 동안 남기지 않는다
    input = bypass ? rawWin : holding || onlyTone(rms(win), rms(removedWin)) ? silent : win
  }
  const frame = analyzer.process(input, muted)
  post({ type: 'frame', frame, t: m.t, ms: performance.now() - t0w, skipped, calib: off })
  skipped = 0
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data
  switch (m.type) {
    case 'init':
      sr = m.sampleRate
      analyzer = createAnalyzer({ sampleRate: sr, windowSize: WINDOW, hzMin: 40, hzMax: 4200 })
      analyzer.setSettings(m.settings)
      ringPos = 0; filled = 0; dropBefore = -1; minOffset = Infinity; mutes.length = 0; arrival.reset()
      tone = null; probe = null; toneHoldUntil = -1; toneOffAt = Infinity
      port = m.port; port.onmessage = onChunk
      post({ type: 'ready' })
      break
    case 'settings': analyzer?.setSettings(m.settings); break
    case 'reset': analyzer?.reset(); filled = 0; dropBefore = m.afterT; minOffset = Infinity; break
    case 'mute': mutes.push({ from: m.from, until: m.until }); if (mutes.length > 64) mutes.shift(); arrival.expect(m.at); break
    case 'tone':
      if (m.hz === null) { if (tone) toneOffAt = m.at + TONE_TAIL_S; break }
      if (!tone || Math.abs(tone.hz - m.hz) > 1e-6) { tone = createToneFilter(sr, m.hz); probe = createToneProbe(sr, m.hz, WINDOW); toneHoldUntil = m.at + TONE_SETTLE_S }
      toneOffAt = Infinity
      break
    // 소리 장치가 바뀌었다(이어폰을 꽂거나 뺐다): 들리는 것으로 되돌리고, 켤 때처럼 필터가 새 소리에 자리 잡는 동안 무음 — 노치의 울림이 음으로 뜨지 않게
    case 'toneRecheck': if (probe) { probe.recheck(); toneHoldUntil = Math.max(toneHoldUntil, lastT + TONE_SETTLE_S); analyzer?.reset() } break
  }
}
