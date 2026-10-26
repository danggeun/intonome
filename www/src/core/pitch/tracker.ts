/**
 * 음 추적기 — 프레임별 (hz, conf) 를 받아 표시할 음/센트를 결정한다.
 * 신뢰도 가중 중앙값 → 음이름 히스테리시스(±switchCents, switchFrames 연속이면 전환) → 표시용 지수 평활.
 * 모든 계산은 A4=440 기준 절대 cents (a = 1200·log2(hz/440)). 기준음(refHz) 보정은 호출부에서.
 */
export interface TrackerParams {
  /** 후보로 인정할 최소 신뢰도 */
  confMin: number
  /** 무음에서 음을 새로 띄우는 데 필요한 연속 유효 프레임 수 — 말소리 모음·새소리·딸깍은 그보다 짧거나 그동안 음높이가 미끄러진다.
   * 6 프레임 = 첫 음이 소리 시작 뒤 약 0.17 s 에 뜬다(48 kHz 기준 창 85 ms + 5 × 21 ms). 이어 켜는 동안의 음 바뀜과는 무관.
   * 7 은 쉬었다가 스피카토로 시작하는 음계(음마다 유효 4~5 프레임, 음이 바뀌면 처음부터)를 끝까지 못 띄웠다 — 6 은 둘째 음에서 띄운다 */
  acquireFrames: number
  /** 그 프레임들의 원시 추정이 중앙값에서 이만큼(cents) 안에 모여야 새로 띄운다 — 미끄러지는 피치·튀는 값은 음이 아니다. 처음부터 넓게(±30 ¢) 떠는 비브라토도 들어온다 */
  acquireCents: number
  /** 새로 띄우는 동안 이만큼 이어진 무효 프레임은 처음부터 다시 세지 않고 건너뛴다 — 시끄러운 곳(잡음이 연주만큼 큰 곳)에서 한 프레임씩 빠지는 탓에 첫 음이 0.7 s 까지 늦었다 */
  acquireGap: number
  /** 가중 중앙값 창 길이 (프레임) */
  medianLen: number
  /** 현재 음에서 이만큼(cents) 벗어나면 "다른 음 후보" */
  switchCents: number
  /** 다른 음 후보가 이 프레임 수만큼 연속되면 전환 */
  switchFrames: number
  /** 메트로놈 클릭과 겹친 프레임이면 전환에 이만큼 필요 — 클릭과 연주 음이 섞여 생긴 가상 기본음(예: C#6 + 클릭 → F#5)이 두 프레임 이어진다(실측) */
  clickSwitchFrames: number
  /** 유효 프레임이 끊긴 뒤 표시를 유지하는 프레임 수 — 활을 들었다 놓는 틈(≈ 0.3 s)에 음이름이 사라졌다 나오지 않게 */
  releaseFrames: number
}
/** cents 는 가장 가까운 음에서의 편차이므로 정의상 이 값을 넘을 수 없다 */
const HALF_SEMITONE = 50
export const DEFAULT_TRACKER: TrackerParams = { confMin: 0.5, acquireFrames: 6, acquireCents: 40, acquireGap: 1, medianLen: 3, switchCents: 65, switchFrames: 2, clickSwitchFrames: 3, releaseFrames: 20 }

/** @property held 유효 프레임이 끊겨 직전 값을 그대로 다시 내보낸 횟수 (0 = 방금 측정한 값). 트레이스가 유지 프레임을 구분하는 데 쓴다
 * @property settling 음이름이 바뀐 프레임과 그 뒤 medianLen 프레임 — 창과 중앙값에 이전 음이 섞여 있다. 읽는 값(숫자)의 평균에 넣지 않는다 */
export interface TrackOut { hz: number; midi: number; a: number; held: number; settling: boolean }
const NONE: TrackOut = { hz: -1, midi: -1, a: NaN, held: 0, settling: false }

export interface Tracker {
  /** @param hz 원시 추정 (-1 없음) @param conf 0..1 @param valid RMS 게이트 등 외부 조건 @param alpha 평활 계수 @param click 메트로놈 클릭과 겹친 프레임 */
  push(hz: number, conf: number, valid: boolean, alpha: number, click?: boolean): TrackOut
  reset(): void
}

export function createTracker(p: TrackerParams = DEFAULT_TRACKER): Tracker {
  const candA: number[] = [], candW: number[] = []
  /** 무음에서 새로 띄우기 전, 지금 이어지는 유효 프레임들의 원시 추정(최근 acquireFrames 개) — 중앙값 창보다 길게 볼 수 있다 */
  const acqA: number[] = [], acqW: number[] = []
  let acqMiss = 0, midi = -1, dispA = NaN, outside = 0, miss = 0, errSign = 0, sameSignRun = 0, settle = 0
  let last: TrackOut = NONE

  function weightedMedian(A: number[] = candA, Wt: number[] = candW): number {
    const idx = A.map((_, i) => i).sort((i, j) => A[i]! - A[j]!)
    const total = Wt.reduce((s, w) => s + w, 0); let acc = 0
    for (const i of idx) { acc += Wt[i]!; if (acc >= total / 2) return A[i]! }
    return A[idx[idx.length - 1]!]!
  }
  function reset(): void { candA.length = 0; candW.length = 0; acqA.length = 0; acqW.length = 0; acqMiss = 0; midi = -1; dispA = NaN; outside = 0; miss = 0; errSign = 0; sameSignRun = 0; settle = 0; last = NONE }
  const out = (settling = false): TrackOut => { last = { hz: 440 * Math.pow(2, dispA / 1200), midi, a: dispA, held: 0, settling }; return last }

  return {
    reset,
    push(hz, conf, valid, alpha, click = false) {
      const ok = valid && hz > 0 && conf >= p.confMin
      if (!ok) {
        if (++acqMiss > p.acquireGap) { acqA.length = 0; acqW.length = 0 }
        if (midi === -1) return NONE
        if (++miss > p.releaseFrames) { reset(); return NONE }
        return { ...last, held: miss } // 짧은 끊김은 마지막 표시 유지 (몇 번째 유지인지 알려준다)
      }
      miss = 0; acqMiss = 0
      const a = 1200 * Math.log2(hz / 440)
      candA.push(a); candW.push(conf); if (candA.length > p.medianLen) { candA.shift(); candW.shift() }
      const med = weightedMedian()
      if (midi === -1) {
        // 새로 띄우기: 같은 음으로 acquireFrames 연속 — 한 프레임의 높은 신뢰도만으로 띄우면 주변 말소리·새소리가 틱틱 뜬다
        acqA.push(a); acqW.push(conf); if (acqA.length > p.acquireFrames) { acqA.shift(); acqW.shift() }
        const acqMed = weightedMedian(acqA, acqW)
        if (acqA.length < p.acquireFrames || acqA.some(x => Math.abs(x - acqMed) > p.acquireCents)) return NONE
        acqA.length = 0; acqW.length = 0
        midi = Math.round(med / 100) + 69; dispA = med; outside = 0
        return out()
      }
      // 표시값은 항상 중앙값을 따라가고(평활), 음이름 라벨만 히스테리시스로 바뀐다.
      // 적응 평활: 오차가 크고 한 방향으로 4프레임 이상 계속될 때만 빠르게 따라붙는다 — 비브라토는 부호가 3–4프레임마다 바뀐다
      const diff = med - dispA, err = Math.abs(diff), sign = diff > 0 ? 1 : diff < 0 ? -1 : 0
      sameSignRun = sign !== 0 && sign === errSign ? sameSignRun + 1 : 1; errSign = sign
      const boost = sameSignRun >= 4 ? Math.min(1, Math.max(0, (err - 30) / 60)) : 0
      const dev = med - (midi - 69) * 100
      // 바늘은 중앙값이 지금 음의 띠 안에 있거나(보통) 바늘 가까이 있을 때(라벨이 아직 안 바뀐 슬라이드) 따라간다. 둘 다 아니면 — 멀리 떨어진 다른 음 후보 —
      // 확인(switchFrames)되기 전엔 끌려가지 않는다: 한 옥타브 떨어진 후보로 미끄러지는 동안 낸 적 없는 중간 음이 화면에 뜨기 때문
      // 음이 바뀐 뒤 중앙값 창이 새 음으로 찰 때까지는 평활하지 않는다 — 평활을 이어 가면 이전 음 쪽 값이 새 음의 바늘·숫자를 0.2~0.4 s 끌어당긴다(반음 슬러·포지션 이동)
      const settling = settle > 0
      if (settling && Math.abs(dev) <= p.switchCents) { dispA = med; settle-- }
      else if (Math.abs(dev) <= p.switchCents || err <= p.switchCents) dispA += diff * (alpha + (1 - alpha) * boost)
      const was = midi
      if (Math.abs(dev) <= p.switchCents) outside = 0
      else if (++outside >= (click ? p.clickSwitchFrames : p.switchFrames)) { midi = Math.round(med / 100) + 69; dispA = med; outside = 0 }
      // 표시 일관성: 부스트가 dispA 를 한 프레임에 새 음까지 옮겨도 라벨은 switchFrames 를 기다리므로, ±50 ¢ 를 넘으면 라벨을 즉시 맞춘다.
      // 이때 중앙값은 대개 이미 새 음 쪽에 있다 — 그 값에서 시작한다(평활값이면 새 음이 ∓49 ¢ 로 시작한다)
      if (Math.abs(dispA - (midi - 69) * 100) > HALF_SEMITONE) {
        midi = Math.round(dispA / 100) + 69; outside = 0
        if (Math.abs(med - (midi - 69) * 100) <= HALF_SEMITONE) dispA = med
      }
      if (midi !== was) settle = p.medianLen
      return out(settling || midi !== was)
    },
  }
}
