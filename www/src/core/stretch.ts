/**
 * 시간 늘이기(음높이 유지) — WSOLA. 편집기의 배속 재생이 쓴다(아이폰 WebKit 은 Web Audio 에 연결된 <audio> 의 배속을 깨뜨린다).
 * 스트리밍: 모노 소스에서 읽어 출력 블록을 채운다. 배속·위치는 재생 중에 바꿀 수 있다. 순수
 *
 * 프레임: 창 ≈ 42.7 ms(48 kHz 에서 2048), 출력은 반씩 겹쳐 더한다(주기 Hann — 겹친 합이 정확히 1).
 * 다음 프레임은 소스의 명목 위치(배속만큼 전진) ±10 ms 안에서 앞 프레임의 자연스러운 이어짐과 가장 닮은 자리를 고른다(거칠게 4 샘플 → 곱게 1 샘플).
 * 위치를 옮긴(seek) 직후의 첫 프레임은 고르지 않는다 — 앞 프레임의 꼬리(내려가는 반창)와 새 자리의 머리(올라가는 반창)가 그대로 교차 페이드가 된다.
 */
export interface Stretcher {
  /** out 을 채운다. 반환: 채운 샘플 수 — 소스 끝에 닿으면 out.length 보다 작고 나머지는 0 */
  render(out: Float32Array): number
  /** 소스 위치(샘플)로 옮긴다. crossfade(재생 중 점프): 이미 계산된 반 프레임(≈ 21 ms)이 나가고 앞 소리의 꼬리와 교차 페이드.
   * 아니면(멈춰 있다 시작): 앞 소리를 버리고 새 자리에서 반 프레임 동안 올라온다 */
  seek(srcSample: number, crossfade?: boolean): void
  /** 배속 (0.5 = 절반 속도) */
  rate: number
  /** 다음에 나갈 출력 샘플의 소스 위치(샘플). 옮긴 직후 교차 페이드 동안은 옮긴 자리 */
  readonly position: number
  /** 소스 끝까지 다 내보냈다 */
  readonly ended: boolean
}

const WIN_SEC = 2048 / 48000, SEARCH_SEC = 480 / 48000

export function createStretcher(src: Float32Array, sampleRate: number, rate = 1): Stretcher {
  const hs = Math.max(64, Math.round(WIN_SEC * sampleRate / 2)), n = hs * 2
  const d = Math.max(4, Math.round(SEARCH_SEC * sampleRate))
  const win = new Float32Array(n)
  for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n)
  const acc = new Float32Array(n) // 겹쳐 더하는 중인 출력. 앞 hs 가 다 차면 내보낸다
  const ready = new Float32Array(hs) // 다 찬 출력 반 프레임
  let readyAt = hs // ready 에서 다음에 읽을 자리 (hs = 비었음)
  let readyBest = 0 // ready 를 만든 프레임의 소스 시작 — 위치 보고용
  let nominal = 0 // 다음 프레임의 명목 소스 위치 (소수)
  let prev = -1 // 앞 프레임의 소스 시작. -1 = 고르지 않는다(처음·seek 직후)
  let draining = false, ended = false
  let jumped: number | null = null // 교차 페이드로 옮긴 자리 — 새 프레임이 나가기 시작하면 지운다

  // 닮음은 겹치는 앞 반창(새 프레임이 올라오는 자리)에서만 잰다. 거칠게 찾을 땐 4 샘플마다 — 오디오 스레드의 한 블록(2.7 ms)에 프레임 하나가 다 들어간다
  const corr = (c: number, tpl: number, step: number): number => { let s = 0; for (let i = 0; i < hs; i += step) s += src[c + i]! * src[tpl + i]!; return s }
  /** 다음 프레임을 겹쳐 더하고 다 찬 반 프레임을 ready 로. 소스가 모자라면 false */
  function frame(): boolean {
    const nom = Math.round(nominal)
    if (nom < 0 || nom + n > src.length) return false
    let best = nom
    const tpl = prev + hs
    if (prev >= 0 && tpl + n <= src.length) {
      const lo = Math.max(0, nom - d), hi = Math.min(src.length - n, nom + d)
      let bestC = -Infinity
      for (let c = lo; c <= hi; c += 4) { const s = corr(c, tpl, 4); if (s > bestC) { bestC = s; best = c } }
      const lo2 = Math.max(lo, best - 3), hi2 = Math.min(hi, best + 3)
      bestC = -Infinity
      for (let c = lo2; c <= hi2; c++) { const s = corr(c, tpl, 1); if (s > bestC) { bestC = s; best = c } }
    }
    for (let i = 0; i < n; i++) acc[i]! += src[best + i]! * win[i]!
    ready.set(acc.subarray(0, hs)); acc.copyWithin(0, hs); acc.fill(0, hs)
    readyAt = 0; readyBest = best; jumped = null
    prev = best; nominal += hs * st.rate
    return true
  }
  /** 소스 끝: 마지막 프레임의 꼬리(내려가는 반창)를 내보내고 끝 */
  function drain(): void { ready.set(acc.subarray(0, hs)); acc.fill(0); readyAt = 0; readyBest = prev >= 0 ? prev + hs : Math.round(nominal); draining = true }

  const st: Stretcher = {
    rate,
    get position() { return jumped ?? (readyAt < hs ? readyBest + readyAt : Math.round(nominal)) },
    get ended() { return ended },
    seek(s, crossfade = true) {
      nominal = Math.max(0, Math.min(src.length, s)); prev = -1; draining = false; ended = false
      if (!crossfade) { acc.fill(0); readyAt = hs; jumped = null } else jumped = Math.round(nominal)
    },
    render(out) {
      let k = 0
      while (k < out.length) {
        if (readyAt >= hs) {
          if (ended) break
          if (draining) { ended = true; break }
          if (!frame()) { drain(); continue }
        }
        const m = Math.min(out.length - k, hs - readyAt)
        out.set(ready.subarray(readyAt, readyAt + m), k); readyAt += m; k += m
      }
      if (k < out.length) out.fill(0, k)
      return k
    },
  }
  return st
}
