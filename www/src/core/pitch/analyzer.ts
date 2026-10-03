/**
 * 프레임 분석기 — 창(window) 하나를 받아 튜너/연주감지 결과를 낸다. 순수 (워커·벤치마크 공용).
 * 파이프라인: RMS → YIN(FFT) + conf → 스펙트럼(옥타브 교정, 배음, 평탄도) → 트래커 → 표시값, 감지기 → playing
 */
import { createYinFast } from './yinFast.ts'
import { createSpectrum } from './spectrum.ts'
import { createTracker, DEFAULT_TRACKER, type TrackerParams } from './tracker.ts'
import { createDetector, DEFAULT_DETECTOR, type DetectorParams } from '../playing/detector.ts'

export interface AnalyzerParams {
  sampleRate: number
  windowSize?: number
  hzMin?: number
  hzMax?: number
  yinThreshold?: number
  tracker?: Partial<TrackerParams>
  detector?: Partial<DetectorParams>
}
/** 런타임에 바뀌는 사용자 설정 */
export interface AnalyzerSettings { rmsMin: number; smoothing: number; refHz: number; tolCents: number }

export interface Frame {
  /** 원시 YIN 추정 (옥타브 교정 후), 없으면 -1 */
  rawHz: number
  conf: number
  rms: number
  harmonics: number
  flatness: number
  /** 표시 주파수 (트래커 출력), 없으면 -1 */
  hz: number
  midi: number
  cents: number
  inTune: boolean
  playing: boolean
  /** 트래커가 직전 값을 그대로 내보낸 횟수 (0 = 새로 측정한 값). 트레이스는 이 값이 쌓인 프레임을 그리지 않는다 */
  held: number
}

export interface Analyzer {
  readonly windowSize: number
  /** @param muted 이 창에 메트로놈 클릭이 섞여 있음 — 트래커 신뢰도만 낮추고 감지기는 상태를 유지한다 */
  process(buf: Float32Array | Float64Array, muted?: boolean): Frame
  setSettings(s: Partial<AnalyzerSettings>): void
  getSettings(): AnalyzerSettings
  reset(): void
}

/** 표시용 정합성: f0 자리 피크가 잡음 바닥보다 이만큼(dB) 솟아야 트래커에 넣는다 (YIN 은 중음의 가상 기본음도 높은 신뢰도로 낸다). 감지기에는 원본 신뢰도 */
const SPEC_MIN_DB = 6 // octaveCorrect 의 기준과 같은 값

/** 표시 안정성 게이트: 최근 RAW_RING 프레임의 원시 추정이 비율 RAW_SPREAD_MAX 넘게 벌어지면 표시용 신뢰도만 0 (감지기 무관) */
const RAW_RING = 4, RAW_SPREAD_MAX = 1.9

export function createAnalyzer(p: AnalyzerParams): Analyzer {
  const N = p.windowSize ?? 4096, sr = p.sampleRate
  const yin = createYinFast(N, { threshold: p.yinThreshold ?? 0.10, hzMin: p.hzMin ?? 40, hzMax: p.hzMax ?? 4200 })
  const spec = createSpectrum(N)
  const tracker = createTracker({ ...DEFAULT_TRACKER, ...p.tracker })
  const det = createDetector({ ...DEFAULT_DETECTOR, ...p.detector })
  const s: AnalyzerSettings = { rmsMin: .014, smoothing: .14, refHz: 442, tolCents: 15 }
  const rawRing: number[] = []
  /** 최근 원시 추정이 옥타브 안에 모여 있는가 */
  function rawStable(hz: number): boolean {
    if (hz > 0) { rawRing.push(hz); if (rawRing.length > RAW_RING) rawRing.shift() }
    if (rawRing.length < RAW_RING) return true // 아직 판단할 근거가 없으면 막지 않는다
    let lo = Infinity, hi = 0
    for (const v of rawRing) { if (v < lo) lo = v; if (v > hi) hi = v }
    return hi / lo <= RAW_SPREAD_MAX
  }
  const EMPTY = (rms: number): Frame => ({ rawHz: -1, conf: 0, rms, harmonics: 0, flatness: 1, hz: -1, midi: -1, cents: 0, inTune: false, playing: det.on, held: 0 })

  return {
    windowSize: N,
    setSettings(patch) { Object.assign(s, patch) },
    getSettings() { return { ...s } },
    reset() { tracker.reset(); det.reset(); rawRing.length = 0 },
    process(buf, muted = false) {
      let e = 0; for (let i = 0; i < N; i++) e += buf[i]! * buf[i]!
      const rms = Math.sqrt(e / N), rmsOk = rms >= s.rmsMin
      if (!rmsOk) { // 게이트 아래: 트래커/감지기에 무효 프레임을 알린다
        rawRing.length = 0
        const t = tracker.push(-1, 0, false, s.smoothing); const playing = det.push({ conf: 0, rmsOk: false, harmonics: 0, flatness: 1 })
        const f = EMPTY(rms); f.playing = playing
        if (t.hz > 0) { fill(f, t.hz, t.midi); f.held = t.held }
        return f
      }
      const y = yin.process(buf, sr)
      spec.update(buf, sr)
      let rawHz = y.hz
      if (rawHz > 0) rawHz = spec.octaveCorrect(rawHz)
      const harmonics = rawHz > 0 ? spec.harmonicCount(rawHz) : 0
      const flatness = spec.flatness()
      // 클릭이 섞인 창: 감지기는 건드리지 않는다 (짧은 클릭으로 연주 시간이 끊기지 않게)
      const playing = muted ? det.on : det.push({ conf: y.conf, rmsOk, harmonics, flatness, cents: rawHz > 0 ? 1200 * Math.log2(rawHz / 440) : NaN })
      // 표시용 신뢰도: 스펙트럼 정합성 실패면 0 (트래커의 confMin 게이트에서 걸러진다)
      const specOk = rawHz > 0 && spec.harmonicCount(rawHz, 1, SPEC_MIN_DB) > 0
      const dispConf = specOk && rawStable(rawHz) ? y.conf : 0
      // 트래커의 음이름 격자는 A=440 기준이라 refHz 로 정규화해 넣는다 (안 하면 |오프셋| > 50 ¢ 에서 이웃 반음으로 라벨링)
      const t = tracker.push(rawHz / refK(), muted ? dispConf * 0.25 : dispConf, true, s.smoothing)
      const f: Frame = { rawHz, conf: y.conf, rms, harmonics, flatness, hz: -1, midi: -1, cents: 0, inTune: false, playing, held: t.held }
      if (t.hz > 0) fill(f, t.hz, t.midi)
      return f
    },
  }
  function refK(): number { return s.refHz / 440 }
  /** hzNorm 은 440 격자로 정규화된 값. 표시 주파수는 되돌리고, cents 는 정규화 공간에서 계산하면 곧 refHz 기준이다 */
  function fill(f: Frame, hzNorm: number, midi: number): void {
    const ref440 = 440 * Math.pow(2, (midi - 69) / 12)
    f.hz = hzNorm * refK(); f.midi = midi; f.cents = Math.round(1200 * Math.log2(hzNorm / ref440)); f.inTune = Math.abs(f.cents) <= s.tolCents
  }
}
