/**
 * 프레임 분석기 — 창(window) 하나를 받아 튜너/연주감지 결과를 낸다. 순수 (워커·벤치마크 공용).
 * 파이프라인: RMS → YIN(FFT) + conf → 스펙트럼(옥타브 교정, 배음, 평탄도) → 트래커 → 표시값, 감지기 → playing
 */
import { createYinFast } from './yinFast.ts'
import { createSpectrum } from './spectrum.ts'
import { createTracker, DEFAULT_TRACKER, type TrackerParams } from './tracker.ts'
import { createDetector, DEFAULT_DETECTOR, type DetectorParams } from '../playing/detector.ts'
import { createReadout, type ReadoutParams } from './readout.ts'
import { isClickPitch } from '../metro/clickPitch.ts'

export interface AnalyzerParams {
  sampleRate: number
  windowSize?: number
  /** 프레임 간격 (샘플). 읽는 값의 평균 길이를 초로 맞추는 데 쓴다 */
  hop?: number
  hzMin?: number
  hzMax?: number
  yinThreshold?: number
  tracker?: Partial<TrackerParams>
  detector?: Partial<DetectorParams>
  readout?: Partial<ReadoutParams>
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
  /** 가장 가까운 음에서의 편차 (¢, 반올림 안 함) — 선(트레이스)용 */
  cents: number
  /** 사람이 읽는 cents 숫자 (정수, 차분하게 — readout.ts). 음이 없으면 0 */
  readCents: number
  /** |readCents| ≤ 허용 오차 — 숫자와 초록이 늘 일치한다 */
  inTune: boolean
  playing: boolean
  /** 트래커가 직전 값을 그대로 내보낸 횟수 (0 = 새로 측정한 값). 트레이스는 이 값이 쌓인 프레임을 그리지 않는다 */
  held: number
}

export interface Analyzer {
  readonly windowSize: number
  /** @param muted 이 창에 메트로놈 클릭이 섞여 있음 — 클릭 음높이로 읽힌 프레임만 버리고, 다른 음으로 바뀔 때 한 프레임 더 확인한다. 감지기는 상태를 유지한다 */
  process(buf: Float32Array | Float64Array, muted?: boolean): Frame
  setSettings(s: Partial<AnalyzerSettings>): void
  getSettings(): AnalyzerSettings
  reset(): void
}

/** 표시용 정합성: f0 자리 피크가 잡음 바닥보다 이만큼(dB) 솟아야 트래커에 넣는다 (YIN 은 중음의 가상 기본음도 높은 신뢰도로 낸다). 감지기에는 원본 신뢰도 */
const SPEC_MIN_DB = 6 // octaveCorrect 의 기준과 같은 값
/** 읽는 값: 0.37 s(5.5 Hz 비브라토 두 주기) 평균, 1.5 ¢ 넘게 움직여야 숫자가 바뀐다, 6 프레임 연속 한쪽으로 3 ¢ 넘으면 바로 따라간다 */
const READ_S = 0.37
const DEFAULT_READOUT: Omit<ReadoutParams, 'windowFrames'> = { deadband: 1.5, trendFrames: 6, trendCents: 3 }

export function createAnalyzer(p: AnalyzerParams): Analyzer {
  const N = p.windowSize ?? 4096, sr = p.sampleRate
  const yin = createYinFast(N, { threshold: p.yinThreshold ?? 0.10, hzMin: p.hzMin ?? 29, hzMax: p.hzMax ?? 4200 })
  const spec = createSpectrum(N)
  const tracker = createTracker({ ...DEFAULT_TRACKER, ...p.tracker })
  const det = createDetector({ ...DEFAULT_DETECTOR, ...p.detector })
  const read = createReadout({ windowFrames: Math.max(1, Math.round(READ_S * sr / (p.hop ?? 1024))), ...DEFAULT_READOUT, ...p.readout })
  const s: AnalyzerSettings = { rmsMin: .014, smoothing: .14, refHz: 442, tolCents: 15 }
  const EMPTY = (rms: number): Frame => ({ rawHz: -1, conf: 0, rms, harmonics: 0, flatness: 1, hz: -1, midi: -1, cents: 0, readCents: 0, inTune: false, playing: det.on, held: 0 })

  return {
    windowSize: N,
    setSettings(patch) {
      // 기준음이 바뀌면 트래커·읽는 값의 상태(440 정규화 공간)를 그만큼 옮긴다 — 안 옮기면 refK 만 즉시 바뀌어 Hz 가 드럼 값을 따라가고
      // 숫자·초록이 0.3~0.9 s 늦게 맞춰졌다(2.5.7 까지)
      const old = s.refHz
      Object.assign(s, patch)
      if (patch.refHz !== undefined && patch.refHz !== old && old > 0) {
        const delta = 1200 * Math.log2(old / patch.refHz)
        tracker.rebase(delta)
        const t = tracker.current(); if (t.hz > 0) read.rebase(delta, t.midi)
      }
    },
    getSettings() { return { ...s } },
    reset() { tracker.reset(); det.reset(); read.reset() },
    process(buf, muted = false) {
      let e = 0; for (let i = 0; i < N; i++) e += buf[i]! * buf[i]!
      const rms = Math.sqrt(e / N), rmsOk = rms >= s.rmsMin
      if (!rmsOk) { // 게이트 아래: 트래커/감지기에 무효 프레임을 알린다
        const t = tracker.push(-1, 0, false, s.smoothing); const playing = det.push({ conf: 0, rmsOk: false, harmonics: 0, flatness: 1 })
        const f = EMPTY(rms); f.playing = playing
        if (t.hz > 0) { fill(f, t.hz, t.midi, false); f.held = t.held } else read.reset()
        return f
      }
      const y = yin.process(buf, sr)
      spec.update(buf, sr)
      let rawHz = y.hz
      if (rawHz > 0) rawHz = spec.octaveCorrect(rawHz)
      const harmonics = rawHz > 0 ? spec.harmonicCount(rawHz) : 0
      const flatness = spec.flatness()
      // 클릭이 섞인 창: 클릭 음높이로 읽힌 프레임만 버린다. 클릭은 기준음의 두 반음 사이에 있어(clickPitch.ts) 연주 음과 헷갈리지 않는다 —
      // 창을 통째로 버리면 클릭 간격이 0.2 s 보다 짧은 빠른 세분에서 튜너가 아무것도 못 본다
      const clickRead = muted && isClickPitch(rawHz, s.refHz)
      // 감지기도 같은 규칙 — 2.5.7 까지는 muted 창을 전부 건너뛰어, 16분 ≥ 73 · 셋잇단 ≥ 98 · 8분 ≥ 146 bpm 이면 모든 창이 건너뛰어져
      // 연주 시간이 메트로놈을 켜기 전 상태(0 % 또는 100 %)로 얼어붙었다
      const playing = clickRead ? det.on : det.push({ conf: y.conf, rmsOk, harmonics, flatness, cents: rawHz > 0 ? 1200 * Math.log2(rawHz / 440) : NaN })
      // 표시용 신뢰도: 스펙트럼 정합성 실패면 0 (트래커의 confMin 게이트에서 걸러진다). 옥타브로 튀는 한 프레임은 트래커의 중앙값·전환 확인이 삼킨다 —
      // 여기서 비우면 활 바꿈마다 화면이 끊긴다
      const specOk = rawHz > 0 && spec.harmonicCount(rawHz, 1, SPEC_MIN_DB) > 0
      const dispConf = specOk ? y.conf : 0
      // 트래커의 음이름 격자는 A=440 기준이라 refHz 로 정규화해 넣는다 (안 하면 |오프셋| > 50 ¢ 에서 이웃 반음으로 라벨링)
      const t = tracker.push(rawHz / refK(), clickRead ? 0 : dispConf, true, s.smoothing, muted)
      const f: Frame = { rawHz, conf: y.conf, rms, harmonics, flatness, hz: -1, midi: -1, cents: 0, readCents: 0, inTune: false, playing, held: t.held }
      if (t.hz > 0) fill(f, t.hz, t.midi, t.held === 0 && !t.settling); else read.reset() // 음이 바뀐 직후 프레임은 숫자의 평균에 넣지 않는다 (이전 음이 섞였다)
      return f
    },
  }
  function refK(): number { return s.refHz / 440 }
  /** hzNorm 은 440 격자로 정규화된 값. 표시 주파수는 되돌리고, cents 는 정규화 공간에서 계산하면 곧 refHz 기준이다.
   * cents 는 반올림하지 않는다 — 트레이스가 1 ¢(≈ 3 px) 격자에 걸려 계단처럼 보였다. 숫자와 맞음 판정은 읽는 값(readCents)으로 */
  function fill(f: Frame, hzNorm: number, midi: number, fresh: boolean): void {
    const ref440 = 440 * Math.pow(2, (midi - 69) / 12)
    f.hz = hzNorm * refK(); f.midi = midi; f.cents = 1200 * Math.log2(hzNorm / ref440)
    f.readCents = read.push(midi, f.cents, fresh); f.inTune = Math.abs(f.readCents) <= s.tolCents
  }
}
