/**
 * 스펙트럼 특징 — 하모닉 수, 스펙트럼 평탄도, 옥타브 후보 점수.
 * 한 프레임에 FFT 1회(Hann 창) 후 여러 질의를 받는다. AnalyserNode 대체.
 */
import { makeFFT, hannWindow } from './fft.ts'

export interface Spectrum {
  /** 프레임 갱신 (buf 길이 = windowSize) */
  update(buf: Float32Array | Float64Array, sr: number): void
  /** f0 의 배음 k=1..maxK 중 국소 바닥보다 minDb 이상 솟은 피크 개수 */
  harmonicCount(f0: number, maxK?: number, minDb?: number): number
  /** 밴드 내 스펙트럼 평탄도 (0=순음/배음 구조, 1=백색잡음) */
  flatness(loHz?: number, hiHz?: number): number
  /** YIN 이 낸 f0 를 실제로 울리는 가장 낮은 배음렬의 기본음으로 — 한 옥타브 높게 잡았으면 f0/2, 자리가 비어 있으면(중음의 가상 기본음·약한 기본음) 그 정수배 */
  octaveCorrect(f0: number): number
  /** 빈 폭 (Hz) */
  readonly binHz: number
}

export function createSpectrum(windowSize: number): Spectrum {
  const N = windowSize, H = N >> 1
  const fft = makeFFT(N), win = hannWindow(N)
  const re = new Float64Array(N), im = new Float64Array(N)
  const db = new Float64Array(H), lin = new Float64Array(H)
  let sr = 44100, binHz = sr / N, floorDb = -120, maxDb = -120
// 중음 간격 (위/아래), 오름차순. 정수(옥타브)는 배음과 구분 불가, 단2도(16/15)는 f0 피크 스커트와 겹쳐 제외
const UPPER_RATIOS = [9 / 8, 6 / 5, 5 / 4, 4 / 3, 7 / 5, 3 / 2, 8 / 5, 5 / 3, 9 / 5]
const VETO_DB = 12 // 정합성 거부권을 가질 피크의 최소 세기 (최대 피크 대비)
const K_MAX = 12 // f0 위로 조사할 배수 상한. 장2도(8:9)·단6도(5:8) 중음까지 덮는다
const REL_DB = 40 // 배음으로 인정할 프레임 최대 피크 대비 상한 (창 누설 피크 배제)

  /** hz 근처(±max(1빈, tolRatio))의 국소 최대 빈. 이웃 피크의 창 누설 스커트는 단조 구간이라 제외된다 */
  function peakNear(hz: number, tolRatio: number): { db: number; bin: number } {
    const b = hz / binHz, half = Math.max(1, b * tolRatio)
    const lo = Math.max(1, Math.round(b - half)), hi = Math.min(H - 2, Math.round(b + half))
    let best = -Infinity, bb = -1
    for (let i = lo; i <= hi; i++) { const v = db[i]!; if (v > best && v >= db[i - 1]! && v >= db[i + 1]!) { best = v; bb = i } }
    if (bb === -1) return { db: -Infinity, bin: Math.round(b) }
    return { db: best, bin: bb }
  }
  /** 잡음 바닥 = 40–5000 Hz 밴드 dB 의 중앙값 (피크 주변 평균은 저음에서 이웃 배음을 포함한다 — C2 는 배음 간격 6 빈) */
  let medianDb = -120
  const sortBuf = new Float64Array(H)
  function computeFloor(): void {
    const lo = Math.max(1, Math.floor(40 / binHz)), hi = Math.min(H - 1, Math.ceil(5000 / binHz))
    const n = hi - lo + 1; for (let i = 0; i < n; i++) sortBuf[i] = db[lo + i]!
    const v = sortBuf.subarray(0, n).sort(); medianDb = v[n >> 1]!
  }
  function localFloor(_bin: number): number { return medianDb }
  /** 국소 바닥 대비 minDb 이상 솟고, 프레임 최대 피크 대비 REL_DB 이내인 피크가 hz 근처에 있는가 */
  function present(hz: number, minDb = 12): boolean {
    if (hz < 20 || hz >= sr / 2) return false
    const p = peakNear(hz, 0.03)
    return p.db - localFloor(p.bin) >= minDb && p.db >= maxDb - REL_DB
  }

  /** r 이 중음 간격(UPPER_RATIOS) 중 하나와 3 % 안에서 맞는가 */
  function isUpperRatio(r: number): boolean { return UPPER_RATIOS.some(u => Math.abs(r / u - 1) < 0.03) }

  return {
    get binHz() { return binHz },
    update(buf, s) {
      sr = s; binHz = sr / N
      for (let i = 0; i < N; i++) { re[i] = buf[i]! * win[i]!; im[i] = 0 }
      fft.transform(re, im)
      floorDb = Infinity; maxDb = -Infinity
      for (let i = 0; i < H; i++) { const p = (re[i]! * re[i]! + im[i]! * im[i]!) / (N * N); lin[i] = p; const v = 10 * Math.log10(p + 1e-20); db[i] = v; if (v < floorDb) floorDb = v; if (i >= 2 && v > maxDb) maxDb = v }
      computeFloor()
    },
    harmonicCount(f0, maxK = 8, minDb = 12) {
      let n = 0
      for (let k = 1; k <= maxK; k++) { if (f0 * k >= sr / 2) break; if (present(f0 * k, minDb)) n++ }
      return n
    },
    flatness(loHz = 60, hiHz = 5000) {
      const lo = Math.max(1, Math.floor(loHz / binHz)), hi = Math.min(H - 1, Math.ceil(hiHz / binHz))
      let logSum = 0, sum = 0, n = 0
      for (let i = lo; i <= hi; i++) { const p = lin[i]! + 1e-20; logSum += Math.log(p); sum += p; n++ }
      if (!n) return 1
      return Math.exp(logSum / n) / (sum / n)
    },
    // 화면의 음은 늘 '지금 울리는 가장 낮은 배음렬의 기본음' 이다. 다른 악기·중음의 위 음으로 넘어가는 규칙은 두지 않는다 —
    // 그런 규칙은 다른 연주자가 있는 방에서 남의 음을 내 음보다 먼저 고른다. 프레임 사이에 기억하는 상태도 없다
    octaveCorrect(f0) {
      const p0 = peakNear(f0, 0.03).db
      // 한 옥타브 위로 틀린 경우: f0/2 와 3f0/2 가 f0 피크에 견줄 만큼(−15/−20 dB 이내) 있어야 한다 — 공명 개방현만으로 떨어지지 않게
      if (present(f0 / 2) && present(f0 * 1.5) && peakNear(f0 / 2, 0.03).db >= p0 - 15 && peakNear(f0 * 1.5, 0.03).db >= p0 - 20) return f0 / 2

      // f0 위쪽 배수 자리 조사. 중음이면 YIN 은 두 음의 최대공약수(가상 기본음)를 내고, 실제 음은 그 정수배 자리에 있다
      const S: number[] = []
      for (let k = 1; k <= K_MAX; k++) { if (f0 * k >= sr / 2) break; if (present(f0 * k, 6)) S.push(k) }
      if (S.length === 0) return f0 // 근거 없음 — 호출부가 신뢰도로 처리한다
      const m = S[0]!
      if (m === 1) return f0
      // 두 번째 배음렬 후보: m 의 배수가 아니면서 m 과의 비율이 중음 간격(옥타브 이내 단순 비율)인 자리 — 우연한 높은 k 배제
      const other = S.find(k => k % m !== 0 && isUpperRatio(k / m))
      // 정합성: m·other 의 배수가 아닌 강한 피크(최대 −VETO_DB 이내)가 있으면 기본음이 약한 단음의 배음렬이다 (첼로 C2) → f0 유지.
      // 약한 피크까지 세면 활 잡음·공명 탓에 실제 중음의 절반이 기각된다
      if (other !== undefined && S.some(k => k % m !== 0 && k % other !== 0 && peakNear(f0 * k, 0.03).db >= maxDb - VETO_DB)) return f0
      // 배음렬 하나(단음, 진짜 기본음은 m·f0)든 둘(중음, 아래 음)이든 가장 낮은 배음렬
      return f0 * m
    },
  }
}
