/**
 * 앱이 내는 음: 드론과 A 듣기. 둘은 같은 소리다(삼각파, 같은 음량, 같은 페이드). 동시에 울리지 않는다.
 * 앱이 내는 소리라 주파수 f 를 정확히 안다(같은 기기의 같은 시계). 스피커의 찌그러짐은 f 의 정수배에만,
 * 방 울림은 같은 주파수에만 소리를 만든다. 그래서 튜너는 학습·측정 없이 f 와 그 정수배를 전부 좁게 잘라내고
 * 남은 소리(연주)를 읽는다. 앱 소리만 울릴 때 남는 건 잡음뿐이라 튜너는 반응하지 않는다.
 * 앱 음이 마이크에 들리지 않으면(이어폰) 잘라낼 것이 없으니 잘라내지 않는다(createToneProbe).
 * 한계: 스피커로 울릴 때 연주 음의 성분이 전부 f 의 정수배와 겹치면(같은 음, 옥타브 위, 12도 위를 정확히 맞게 켤 때) 함께 잘려 '--'.
 */
import { midiToHz } from './note.ts'
import { hannWindow } from './pitch/fft.ts'

/** 드론은 모든 악기에서 4옥타브 (262–494 Hz). 폰 스피커는 이 아래에서 급격히 작아진다. 드론은 음이름이 중요하지 옥타브는 아니다 */
const DRONE_OCTAVE = 4
/** 앱 음의 파형. 삼각파: 홀수 배음이 있어 폰 스피커에서도 또렷하다 */
export const TONE_WAVE = 'triangle' as const
/** 앱 음의 진폭 (A 듣기가 쓰던 값 그대로, 드론도 같다) */
export const TONE_GAIN = 0.22
/** 켜고 끌 때의 램프. 없으면 '틱' 소리가 난다 */
export const TONE_FADE_S = 0.03
/** 노치 −3 dB 폭 = 기본음의 1/35 (기본음에서 ±25 ¢). 정수배는 주파수 오차가 없어 모든 배음에 같은 Hz 폭을 쓴다 */
const COMB_Q = 35
/** 폭의 하한. 노치가 자리 잡는 시간은 폭에만 달려 있다: 60 dB 까지 ln(1000) / (π · 7.5 Hz) = 0.29 s */
const COMB_MIN_BW_HZ = 7.5
/** 여기까지의 정수배를 자른다. 분석 대역(40–4200 Hz) 위에서 주기를 만들 수 있는 성분까지 */
const COMB_MAX_HZ = 8000
/** 켜거나 음을 바꾼 뒤 노치가 자리 잡는 시간. 이 동안 튜너는 '--' */
export const TONE_SETTLE_S = 0.3
/** 끈 뒤에도 페이드아웃 + 여유만큼 계속 잘라낸다 */
export const TONE_TAIL_S = 0.15
/** 잘라내고 남은 소리가 잘라낸 소리의 이 비율보다 작으면 '연주 없음' (튜너 '--', 연습 시간도 안 센다) */
const TONE_GATE = 0.12

/** 음 (0 = 도 … 11 = 시) → 드론 주파수. 기준음(A = refHz)을 따른다 */
export function droneHz(pitchClass: number, refHz: number): number {
  return midiToHz((DRONE_OCTAVE + 1) * 12 + pitchClass, refHz)
}
/** A 듣기 주파수: 기준음 A 를 설정 옥타브(aOctave, 4 = A4)로 */
export const playAHz = (refHz: number, aOctave: number): number => refHz * Math.pow(2, aOctave - 4)

/** 앱 음 잘라내기. 청크 경계를 넘어 상태를 이어 간다 */
export interface ToneFilter {
  readonly hz: number
  /** 잘라내는 주파수들 (f, 2f, 3f, …) */
  readonly partials: readonly number[]
  /** x → out(앱 음을 빼고 LP_HZ 위를 걸러낸, 튜너가 읽을 소리), removed(노치가 뺀 소리). 세 배열은 길이가 같다 */
  process(x: Float32Array, out: Float32Array, removed: Float32Array): void
}

/** 앱 음이 켜져 있는 동안 튜너가 읽는 대역의 위쪽 끝. 분석 상한 4200 Hz 위의 성분(노치 범위 밖 배음 포함)을 8차 버터워스로 내린다: 8 kHz −33 dB, 10 kHz −48 dB */
const LP_HZ = 5000
const BUTTER8_Q = [0.5098, 0.6013, 0.9000, 2.5629]

/** f 와 그 정수배(COMB_MAX_HZ, 나이퀴스트의 90 % 중 낮은 쪽까지)를 모두 노치로 자르고, LP_HZ 위를 걸러낸다 */
export function createToneFilter(sampleRate: number, hz: number): ToneFilter {
  const bw = Math.max(hz / COMB_Q, COMB_MIN_BW_HZ), top = Math.min(COMB_MAX_HZ, 0.45 * sampleRate)
  const partials: number[] = []
  for (let k = 1; k * hz <= top; k++) partials.push(k * hz)
  // RBJ biquad 계수 [b0, b1, b2, a1, a2] 와 상태 [x1, x2, y1, y2]. 노치 먼저, 뒤에 저역 통과 4단
  const notch = (f: number) => { const w = 2 * Math.PI * f / sampleRate, cos = Math.cos(w), al = Math.sin(w) / (2 * (f / bw)), a0 = 1 + al; return [1 / a0, -2 * cos / a0, 1 / a0, -2 * cos / a0, (1 - al) / a0] }
  const lowpass = (q: number) => { const w = 2 * Math.PI * Math.min(LP_HZ, 0.45 * sampleRate) / sampleRate, cos = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al; return [(1 - cos) / 2 / a0, (1 - cos) / a0, (1 - cos) / 2 / a0, -2 * cos / a0, (1 - al) / a0] }
  const nN = partials.length, all = [...partials.map(notch), ...BUTTER8_Q.map(lowpass)], n = all.length
  const c = new Float64Array(n * 5), st = new Float64Array(n * 4)
  all.forEach((k, j) => c.set(k, j * 5))
  return {
    hz, partials,
    process(x, out, removed) {
      for (let i = 0; i < x.length; i++) {
        const xi = x[i]!
        let v = xi
        for (let j = 0, o = 0, s = 0; j < n; j++, o += 5, s += 4) {
          if (j === nN) removed[i] = xi - v // 노치가 뺀 것까지만 (저역 통과가 거른 연주 고역은 넣지 않는다)
          const x1 = st[s]!, x2 = st[s + 1]!, y1 = st[s + 2]!, y2 = st[s + 3]!
          const y = c[o]! * v + c[o + 1]! * x1 + c[o + 2]! * x2 - c[o + 3]! * y1 - c[o + 4]! * y2
          st[s + 1] = x1; st[s] = v; st[s + 3] = y1; st[s + 2] = y
          v = y
        }
        out[i] = v
      }
    },
  }
}

export function rms(x: ArrayLike<number>): number { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!; return Math.sqrt(s / (x.length || 1)) }
/** 남은 소리가 잘라낸 앱 음의 TONE_GATE 미만이면 연주가 없는 것 */
export const onlyTone = (residualRms: number, removedRms: number): boolean => residualRms < TONE_GATE * removedRms

/** 앱 음 성분이 튜너 감도 문턱(rmsMin)의 이 비율 아래면 '마이크에 안 들린다' — 튜너가 반응할 수 있는 크기보다 20 dB 작다 */
const TONE_HEARD_OF_GATE = 0.1
/** 이만큼(≈ 85 ms) 연달아 안 들리면 잘라내기를 끈다 */
const TONE_QUIET_FRAMES = 4
/** 끈 뒤 앱 음 성분이 이만큼(≈ 0.13 s) TONE_STEADY_REL 안에서 그대로면 다시 켠다 — 사람이 켜는 소리는 크기·위상이 이렇게 그대로일 수 없다 */
const TONE_STEADY_FRAMES = 6
const TONE_STEADY_REL = 0.01
/** 재는 배음: 5 kHz(분석 대역 위쪽)까지, 많아야 16 개 */
const PROBE_MAX_HZ = 5000, PROBE_MAX_K = 16

/** 앱 음이 마이크에 들리는지. 들리지 않으면(이어폰) bypass — 잘라내지 않고 원래 소리를 읽는다 */
export interface ToneProbe {
  readonly bypass: boolean
  /** win: 잘라내기 전 소리 한 창, n0: 그 창 첫 샘플의 절대 번호(앱 음과 같은 시계), rmsMin: 지금 감도 문턱. 새 bypass 를 돌려준다 */
  frame(win: Float32Array | Float64Array, n0: number, rmsMin: number): boolean
  /** 소리 장치가 바뀌었다 — 들리는 것으로 되돌리고 다시 잰다 */
  recheck(): void
}

/** 처음엔 들리는 것으로 보고(잘라낸다) 연달아 안 들릴 때만 끈다 — 켜는 순간 연주가 같은 음을 내고 있어도 잘못 끄지 않는다(그때는 지금처럼 '--').
 * 끈 뒤에는 앱 음 주파수에서 크기·위상이 그대로인 성분이 나타나면(이어폰을 뺐다) 다시 켠다 */
export function createToneProbe(sampleRate: number, hz: number, windowSize: number): ToneProbe {
  const K = Math.max(1, Math.min(PROBE_MAX_K, Math.floor(Math.min(PROBE_MAX_HZ, 0.45 * sampleRate) / hz)))
  const win = hannWindow(windowSize); let sw = 0; for (let i = 0; i < windowSize; i++) sw += win[i]!
  const X = new Float64Array(2 * K), hist: Float64Array[] = []
  let bypass = false, quiet = 0
  /** 배음 k·f 의 복소 진폭. 위상은 절대 샘플 번호 기준이라 앱 음이면 창마다 같다 */
  function demod(x: Float32Array | Float64Array, n0: number, out: Float64Array): void {
    for (let k = 1; k <= K; k++) {
      const w = 2 * Math.PI * k * hz / sampleRate, ph = (w * n0) % (2 * Math.PI)
      let c = Math.cos(ph), s = Math.sin(ph), re = 0, im = 0
      const dc = Math.cos(w), ds = Math.sin(w)
      for (let j = 0; j < windowSize; j++) { const v = x[j]! * win[j]!; re += v * c; im -= v * s; const c2 = c * dc - s * ds; s = s * dc + c * ds; c = c2 }
      out[2 * k - 2] = 2 * re / sw; out[2 * k - 1] = 2 * im / sw
    }
  }
  const energy = (v: Float64Array) => { let e = 0; for (let i = 0; i < v.length; i++) e += v[i]! * v[i]!; return e }
  return {
    get bypass() { return bypass },
    frame(x, n0, rmsMin) {
      demod(x, n0, X)
      // 배음 자리의 소리 전부(앱 음 + 그 자리에 겹친 연주·잡음). 연주나 잡음이 섞이면 '들린다' 쪽으로 틀린다 — 그때는 지금처럼 잘라낸다
      const e = energy(X), heard = Math.sqrt(e / 2) >= TONE_HEARD_OF_GATE * rmsMin
      if (!bypass) {
        quiet = heard ? 0 : quiet + 1
        if (quiet >= TONE_QUIET_FRAMES) { bypass = true; hist.length = 0 }
        return bypass
      }
      hist.push(X.slice()); if (hist.length > TONE_STEADY_FRAMES) hist.shift()
      if (heard && hist.length === TONE_STEADY_FRAMES) {
        const lim = TONE_STEADY_REL * TONE_STEADY_REL * e
        let steady = true
        for (const h of hist) { let d = 0; for (let i = 0; i < h.length; i++) { const t = h[i]! - X[i]!; d += t * t } if (d > lim) { steady = false; break } }
        if (steady) { bypass = false; quiet = 0; hist.length = 0 }
      }
      return bypass
    },
    recheck() { bypass = false; quiet = 0; hist.length = 0 },
  }
}
