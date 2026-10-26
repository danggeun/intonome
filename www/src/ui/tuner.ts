/**
 * 튜너 카드 UI — 음이름/옥타브/cents/Hz, 히스토리 캔버스, "탭하여 시작" 안내.
 * tunerStore 를 구독해 그린다. 오디오 모듈을 직접 읽지 않는다.
 */
import { octaveOf, noteLabel } from '../core/note.ts'
import { calmHz, fmtHz } from '../core/hzReadout.ts'
import { histLenFor } from '../core/hist.ts'
import { buildSegments, keepInTrace } from '../core/trace.ts'
import { CFG, settingsStore, tunerStore } from '../state/index.ts'
import { q } from './dom.ts'
import { t, getLang, type TKey } from '../core/i18n/index.ts'
import { onLangChange } from './lang.ts'

/** 지금 화면의 Hz 글자 — 같은 글자는 다시 쓰지 않는다 */
let hzText = ''
const setHz = (s: string): void => { if (s !== hzText) { hzText = s; q('tuner-hz').textContent = s } }

let tapHandler: (() => void) | null = null
let tapSub: TKey | null = null
/** 마이크가 꺼진 채로 남았을 때(권한 거절·장치 끊김) 시작 버튼이 부르는 것 — main.ts 가 정한다. 헤더에 MIC 버튼이 없으니 여기가 켜는 곳이다 */
let micOpener: (() => Promise<boolean>) | null = null
let offHandler: (() => void) | null = null
export function setMicOpener(fn: () => Promise<boolean>): void { micOpener = fn }
/** 꺼짐 상태의 시작 버튼 — 카드 전체가 아니라 버튼만 받는다 (카드를 잡으면 A 듣기를 누를 때도 권한을 묻는다) */
function showOffStart(): void {
  const card = q('tuner-card'), btn = q('tuner-start-btn')
  q('tuner-note').textContent = '--'; q('tuner-note').className = 'empty'
  tapSub = null; q('tuner-start-sub').textContent = ''
  card.classList.add('tap-hint')
  if (!offHandler) { offHandler = () => { void micOpener?.() }; btn.addEventListener('click', offHandler) }
}
/** 마이크가 꺼져 있으면 시작 버튼을 띄운다 — 시작할 때 권한이 이미 거절돼 있던 경우 */
export function showMicOff(): void { const s = tunerStore.get(); if (!s.micReady && !s.micReopening && !tapHandler && micOpener) showOffStart() }
function clearOffStart(): void {
  if (!offHandler) return
  q('tuner-start-btn').removeEventListener('click', offHandler); offHandler = null
  if (!tapHandler) q('tuner-card').classList.remove('tap-hint')
}
// 트레이스 버퍼. 길이는 histSec × 프레임률이라 샘플레이트가 정해지면 다시 잡는다. histMidi 는 같은 인덱스의 음이름 — 음이 바뀐 자리에 가로줄을 안 긋기 위해
let histSec: number = CFG.tuner.histSec
let histSr = 44100
let hist: Array<number | null> = new Array(histLenFor(histSr, histSec, CFG.tuner.hop)).fill(null)
let histMidi: Array<number | null> = new Array(hist.length).fill(null)
/** 표시 버퍼라 내용 보존은 불필요 */
function resizeHist(sampleRate: number): void {
  histSr = sampleRate
  const n = histLenFor(sampleRate, histSec, CFG.tuner.hop)
  if (n === hist.length) return
  hist = new Array(n).fill(null); histMidi = new Array(n).fill(null)
}
/** 창 길이(초) 변경 — 비교 렌더/e2e 용 */
export function setHistSec(sec: number): void { histSec = sec; hist = []; resizeHist(histSr) }
/** 마지막 그리기에서 '음이 바뀌어 끊은' 세그먼트 수 (진단값) */
let lastSkipped = 0
/** 테스트·진단용 */
export const histDiag = (): { len: number; sec: number; sr: number; skipped: number } => ({ len: hist.length, sec: histSec, sr: histSr, skipped: lastSkipped })
/** 캔버스 색은 CSS 토큰에서 */
let okRgb = '34,197,94'
let stageBg = '#0d0f13'
let inkRgb = '255,255,255'
function readTokens(): void {
  const cs = getComputedStyle(document.documentElement)
  okRgb = cs.getPropertyValue('--ok-rgb').trim() || okRgb
  stageBg = cs.getPropertyValue('--tuner-bg').trim() || stageBg
  inkRgb = cs.getPropertyValue('--tuner-ink-rgb').trim() || inkRgb
}
/** 테마가 바뀌면 색을 다시 읽고 다시 그린다 */
export function retheme(): void { readTokens(); drawHistory(lastInTune) }
let lastInTune = false

// 히스토리
function drawHistory(inTune: boolean): void {
  const canvas = q<HTMLCanvasElement>('tuner-history'); if (!canvas.offsetWidth) return
  const W = canvas.offsetWidth, H = Math.max(80, canvas.offsetHeight || 100), dpr = devicePixelRatio || 1
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px' }
  lastInTune = inTune
  const c = canvas.getContext('2d')!; c.save(); c.scale(dpr, dpr)
  c.fillStyle = stageBg; c.fillRect(0, 0, W, H)
  if (inTune) { c.fillStyle = `rgba(${okRgb},.07)`; c.fillRect(0, 0, W, H) }
  const ppc = (W / 2) / 50, tol = settingsStore.get().tolCents, N = hist.length, rH = H / N
  lastSkipped = 0
  // 띠는 '영역' — 트레이스보다 뒤로. 옅게: 늘 깔린 진한 초록(화면의 10 %)은 '초록 = 맞음' 을 묻는다. 맞았다는 신호는 음이름·테·바탕이 맡는다
  c.fillStyle = `rgba(${okRgb},.16)`; c.fillRect(W / 2 - tol * ppc, 0, tol * 2 * ppc, H)
  c.strokeStyle = `rgba(${inkRgb},.38)`; c.lineWidth = 1
  c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.stroke()
  // ♭ / ♯ 방향 표시 — 최신 값이 맨 아래라 아래쪽에
  c.fillStyle = `rgba(${inkRgb},.42)`; c.font = "14px 'DM Mono', monospace"; c.textBaseline = 'bottom'
  c.textAlign = 'left'; c.fillText('\u266d', 8, H - 7)
  c.textAlign = 'right'; c.fillText('\u266f', W - 8, H - 7)
  c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round' // 90 cm 에서 보이는 굵기
  // 트레이스는 항상 흰색 — 초록 선은 초록 띠 위에서 대비가 가장 낮아진다. '선이 띠 안' = '맞음' 이라 정보 손실은 없다.
  // 오래된 쪽(위)이 옅어지는 건 그라디언트 한 번으로: 선분마다 반투명으로 따로 그으면 둥근 끝이 이음새마다 겹쳐 점이 찍힌다
  const grad = c.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, `rgba(${inkRgb},.22)`); grad.addColorStop(1, `rgb(${inkRgb})`)
  c.strokeStyle = grad
  // 무엇을 잇고 무엇을 버릴지는 core/trace.ts 가 정한다. 이어지는 선분은 한 경로로 긋는다
  const { segs, breaks } = buildSegments(hist, histMidi)
  lastSkipped = breaks
  const px = (v: number) => W / 2 + Math.max(-50, Math.min(50, v)) * ppc, py = (i: number) => (i + .5) * rH
  let open = false, prevEnd = -1
  for (const [i, j] of segs) {
    if (!open || i !== prevEnd) { if (open) c.stroke(); c.beginPath(); c.moveTo(px(hist[i]!), py(i)); open = true }
    // 건너뛴 프레임을 사이에 둔 이음(음이 바뀐 자리)은 위아래로 접하는 S자 곡선 — 앞 음 자리에서 새 음 자리로 펜처럼 넘어간다
    if (j - i > 1) { const ym = (py(i) + py(j)) / 2; c.bezierCurveTo(px(hist[i]!), ym, px(hist[j]!), ym, px(hist[j]!), py(j)) }
    else c.lineTo(px(hist[j]!), py(j))
    prevEnd = j
  }
  if (open) c.stroke()
  c.restore()
}

// 음 표시
function renderEmpty(): void {
  const nEl = q('tuner-note')
  // 마이크가 꺼져 있으면 빈 상태 카피, 켜져 있거나 스스로 다시 여는 중(micReopening)이면 '--'
  const s = tunerStore.get(), off = !s.micReady && !s.micReopening && !tapHandler
  nEl.textContent = '--'; nEl.className = 'empty'
  if (off && micOpener) showOffStart()
  q('tuner-oct').textContent = ''; q('tuner-cents').textContent = ''; q('tuner-enharmonic').textContent = ''; q('tuner-acc').textContent = ''
  setHz('')
  q('tuner-card').classList.remove('in-tune')
}
/** readCents = 사람이 읽는 숫자(차분한 값), inTune 도 그 숫자로 정해진다 */
function renderNote(midi: number, readCents: number, inTune: boolean, hz: number, cents: number): void {
  const { name, secondary } = noteLabel(midi, settingsStore.get().noteNames, getLang())
  const base = name.replace('♯', ''), acc = name.includes('♯') ? '♯' : ''
  const nEl = q('tuner-note'); nEl.textContent = base; nEl.className = inTune ? 'tune' : ''
  const accEl = q('tuner-acc'); accEl.textContent = acc; accEl.classList.toggle('tune', inTune)
  q('tuner-oct').textContent = String(octaveOf(midi))
  q('tuner-enharmonic').textContent = secondary
  q('tuner-card').classList.toggle('in-tune', inTune)
  q('tuner-cents').textContent = (readCents > 0 ? '+' : '') + readCents + ' ¢'
  setHz(fmtHz(calmHz(hz, cents, readCents))) // Hz 도 숫자와 같은 값 — 숫자가 바뀔 때만 같이 바뀐다
}

/** 시작 버튼. 카드 어디를 눌러도 onTap. sub 는 버튼 아래 한 줄 안내(없으면 비움). onTap 이 true 면 거둔다 */
export function showTapHint(onTap: () => Promise<boolean>, sub?: TKey): void {
  const nEl = q('tuner-note'), card = q('tuner-card')
  nEl.textContent = '--'; nEl.className = 'empty'
  clearOffStart() // 카드 전체가 받으니 버튼 전용 핸들러는 거둔다 (한 번 누름에 두 번 열지 않게)
  tapSub = sub ?? null; q('tuner-start-sub').textContent = sub ? t(sub) : ''
  card.classList.add('tap-hint')
  if (tapHandler) card.removeEventListener('click', tapHandler) // 호출마다 리스너가 쌓이지 않게
  const handler = async () => { if (await onTap()) { card.classList.remove('tap-hint'); card.removeEventListener('click', handler); if (tapHandler === handler) tapHandler = null } }
  tapHandler = handler
  card.addEventListener('click', handler)
}

/** 시작 버튼을 거둔다 */
export function hideTapHint(): void {
  const card = q('tuner-card')
  if (tapHandler) { card.removeEventListener('click', tapHandler); tapHandler = null }
  card.classList.remove('tap-hint')
}
export function mountTuner(): void {
  readTokens()
  // 언어가 바뀌면: 빈 상태 문구·시작 버튼 부제. 음이 떠 있으면 다음 프레임이 새 이름으로 그린다
  onLangChange(() => {
    if (q('tuner-note').classList.contains('empty')) renderEmpty()
    if (tapSub) q('tuner-start-sub').textContent = t(tapSub)
  })
  // 매 분석 프레임(≈43 Hz)마다 히스토리를 쌓고, 그리기는 rAF 에 한 번만
  let dirty = false, raf: number | null = null
  const paint = () => {
    raf = null; if (!dirty) return; dirty = false
    const s = tunerStore.get()
    if (s.hz === -1) { renderEmpty(); drawHistory(false); return }
    renderNote(s.midi, s.readCents, s.inTune, s.hz, s.cents); drawHistory(s.inTune) // 숫자는 읽는 값, 선은 매 프레임 cents
  }
  tunerStore.select(s => s.sampleRate, sr => resizeHist(sr), { immediate: true })
  // 캔버스 크기가 바뀌면 마이크 프레임이 없어도 다시 그린다 — 안 그리면 옛 크기의 비트맵이 늘어나 ♭♯ 가 길쭉해진다(시작 버튼 화면)
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => drawHistory(lastInTune)).observe(q('tuner-history'))
  tunerStore.select(s => s.frame, () => {
    const s = tunerStore.get()
    // 무엇을 트레이스에 쌓을지는 core/trace.ts 가 정한다
    const off = !keepInTrace(s.hz, s.held)
    hist.push(off ? null : s.cents); hist.shift()
    histMidi.push(off ? null : s.midi); histMidi.shift()
    dirty = true; if (raf == null) raf = requestAnimationFrame(paint)
  })
  // 마이크 꺼짐 → 표시 초기화
  tunerStore.select(s => s.micReady, ready => { if (!ready) renderEmpty(); else clearOffStart() })
  // 자동 재개가 실패로 끝나면 그제야 "켜면 시작" — 분석 루프가 안 도니 여기서 직접 그린다
  tunerStore.select(s => s.micReopening, v => { if (!v && !tunerStore.get().micReady) renderEmpty() })
  // 초기 렌더
  setTimeout(() => drawHistory(false), 200)
}
