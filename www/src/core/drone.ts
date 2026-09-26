/**
 * 앱이 내는 음: 드론과 A 듣기. 둘은 같은 소리다(삼각파, 같은 음량, 같은 페이드). 동시에 울리지 않는다.
 * 앱이 내는 소리라 주파수 f 를 정확히 안다(같은 기기의 같은 시계). 스피커의 찌그러짐은 f 의 정수배에만,
 * 방 울림은 같은 주파수에만 소리를 만든다. 그래서 튜너는 학습·측정 없이 f 와 그 정수배를 전부 좁게 잘라내고
 * 남은 소리(연주)를 읽는다. 앱 소리만 울릴 때 남는 건 잡음뿐이라 튜너는 반응하지 않는다.
 * 한계: 연주 음의 성분이 전부 f 의 정수배와 겹치면(같은 음, 옥타브 위, 12도 위를 정확히 맞게 켤 때) 함께 잘려 '--'.
 */
import { midiToHz } from './note.ts'

/** 드론은 모든 악기에서 4옥타브 (262–494 Hz). 폰 스피커는 이 아래에서 급격히 작아진다. 드론은 음이름이 중요하지 옥타브는 아니다 */
export const DRONE_OCTAVE = 4
/** 앱 음의 파형. 삼각파: 홀수 배음이 있어 폰 스피커에서도 또렷하다 */
export const TONE_WAVE = 'triangle' as const
/** 앱 음의 진폭 (A 듣기가 쓰던 값 그대로, 드론도 같다) */
export const TONE_GAIN = 0.22
/** 켜고 끌 때의 램프. 없으면 '틱' 소리가 난다 */
export const TONE_FADE_S = 0.03
/** 노치 −3 dB 폭 = 기본음의 1/35 (기본음에서 ±25 ¢). 정수배는 주파수 오차가 없어 모든 배음에 같은 Hz 폭을 쓴다 */
export const COMB_Q = 35
/** 폭의 하한. 노치가 자리 잡는 시간은 폭에만 달려 있다: 60 dB 까지 ln(1000) / (π · 7.5 Hz) = 0.29 s */
export const COMB_MIN_BW_HZ = 7.5
/** 여기까지의 정수배를 자른다. 분석 대역(40–4200 Hz) 위에서 주기를 만들 수 있는 성분까지 */
export const COMB_MAX_HZ = 8000
/** 켜거나 음을 바꾼 뒤 노치가 자리 잡는 시간. 이 동안 튜너는 '--' */
export const TONE_SETTLE_S = 0.3
/** 끈 뒤에도 페이드아웃 + 여유만큼 계속 잘라낸다 */
export const TONE_TAIL_S = 0.15
/** 잘라내고 남은 소리가 잘라낸 소리의 이 비율보다 작으면 '연주 없음' (튜너 '--', 연습 시간도 안 센다) */
export const TONE_GATE = 0.12

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
export const LP_HZ = 5000
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
