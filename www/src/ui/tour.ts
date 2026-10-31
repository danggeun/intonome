/**
 * 처음 안내 — 새로 설치한 기기에서 튜너가 켜진 뒤 한 번. 화면을 어둡게 하고 볼 곳만 밝힌다.
 * 숨은 동작(소리 내기·기준음 밀기·메트로놈 카드 밀기)은 그 자리에서 해 보면 설명이 바뀌고, 버튼은 짧게 알려 주기만.
 * 안내 중에 켠 것·끈 것(A 듣기·드론·메트로놈 소리, 바꾼 기준음·빠르기·박자, 펼친 카드)은 그 단계를 떠날 때(앱이 뒤로 갈 때도) 되돌린다 — 안내가 사용자의 설정을 남기지 않는다.
 * 언제든 × · Esc · 안드로이드 뒤로 로 그만두고, 설정에서 다시 볼 수 있다. 레이어는 하나만 두고 자리만 옮긴다(밝은 구멍과 말풍선이 미끄러져 간다).
 * 메뉴·설정·드론 창·마이크 안내·편집기가 떠 있는 동안은 숨는다 — 닫히면 그 자리에서 이어진다.
 */
import { settingsStore, tunerStore, metroStore, refToneStore, droneStore, type Settings } from '../state/index.ts'
import { q, on } from './dom.ts'
import { t, type TKey } from '../core/i18n/index.ts'
import { onLangChange } from './lang.ts'
import { isPhoneLayout, setStatusBarTheme } from '../platform/index.ts'
import { stageOf, type Stage } from '../core/metro/card.ts'
import { placeBubble } from '../core/tourPlace.ts'
import { overlayOpen, closeSettings } from './menu.ts'
import { isEditorOpen } from './editor.ts'
import { skipDroneHint } from './drone.ts'
import { stopMetro, toggleMetro, setTimeSig, setSubDiv } from '../audio/metronome.ts'
import { stopRefNote, stopDrone, startDrone } from '../audio/refTone.ts'

type Gesture = 'none' | 'tap' | 'swipeUp' | 'swipeDown' | 'drag'
interface View { title: TKey; body: TKey; gesture: Gesture; pulseAt?: () => HTMLElement | null; vars?: Record<string, string | number> }
interface Step {
  key: string
  /** 밝힐 곳 — 없으면 막만 (마지막 장) */
  target?: () => HTMLElement[]
  pad?: number
  radius?: number
  /** 구멍 안을 누를 수 있는가 — 해 보는 단계만. 보여 주기만 하는 단계에서 녹음 같은 게 시작되면 안 된다 */
  open?: boolean
  /** 해 보는 단계: 다 하기 전엔 "다음"이 연하다(그래도 누를 수 있다 — 막히지 않게) */
  task?: boolean
  view: () => View
}

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches
const metroState = (): Stage => { const { collapsed, full } = metroStore.get(); return stageOf(collapsed, full, isPhoneLayout()) }
/** 안내가 건드릴 수 있는 설정 — 떠날 때 들어올 때 값으로 */
const KEEP = ['refHz', 'bpm', 'timeSig', 'subDiv', 'metroVol'] as const
type Kept = Pick<Settings, typeof KEEP[number]>

// ── 진행 상태 ──
let active = false, i = 0, done = false, leaving = false
/** 메트로놈 단계: 메트로놈만 보는 화면(펼침2)까지 가 봤는가 — 그다음은 내려서 처음처럼 접으면 끝 */
let sawFull = false
/** 단계에 들어올 때의 모습 — 떠날 때 되돌린다 */
let snap: { set: Kept; refTone: boolean; drone: number | null; metroPlaying: boolean; collapsed: boolean; full: boolean } | null = null
/** 메트로놈만 보는 화면에서 다시 보기를 열면 튜너가 숨어 있다 — 안내 동안 펼침으로 두고, 끝나면 돌려놓는다 */
let wasFull = false
/** 처음 실행의 저절로 시작 — 한 번이라도 열리면(다시 보기 포함) 끈다 */
let autoArmed = false
let noteRun = 0
/** 키보드로 쓰는 중인가 — 그때만 말풍선 버튼으로 포커스를 옮긴다(터치에서는 포커스 테두리가 남는다) */
let kbd = false
/** 말풍선으로 포커스 — 스크린 리더가 새 설명을 읽게. 키보드면 바로 "다음" 버튼으로 */
const focusCard = (): void => { if (!L) return; (kbd ? L.next : L.card).focus({ preventScroll: true }) }
let onFinish: (() => void) | null = null

const STEPS: Step[] = [
  // 마이크가 꺼져 있으면 음 자리에 시작 버튼이 뜬다 — 눌러서 켤 수 있게 열어 둔다
  { key: 'note', target: () => [q('tuner-note-row')], pad: 6, radius: 14, open: true, task: true,
    view: () => done ? { title: 'tour.noteDone', body: 'tour.noteDoneBody', gesture: 'none', vars: { tol: settingsStore.get().tolCents } }
      : { title: 'tour.note', body: 'tour.noteBody', gesture: 'none' } },
  { key: 'trace', target: () => [q('tuner-history')], pad: 4, radius: 12,
    view: () => ({ title: 'tour.trace', body: 'tour.traceBody', gesture: 'none' }) },
  { key: 'ref', target: () => [q('ref-row')], pad: 2, radius: 10, open: true, task: true,
    view: () => done ? { title: 'tour.refDone', body: 'tour.refDoneBody', gesture: 'none', vars: { hz: snap?.set.refHz ?? settingsStore.get().refHz } }
      : { title: 'tour.ref', body: 'tour.refBody', gesture: 'drag', pulseAt: () => q('ref-drum-outer') } },
  { key: 'playA', target: () => [q('ref-a-btn')], pad: 6, radius: 10, open: true,
    view: () => ({ title: 'tour.playA', body: 'tour.playABody', gesture: 'tap', pulseAt: () => q('ref-a-btn') }) },
  { key: 'drone', target: () => [q('drone-btn')], pad: 6, radius: 10, open: true,
    view: () => ({ title: 'tour.drone', body: 'tour.droneBody', gesture: 'tap', pulseAt: () => q('drone-btn') }) },
  // 카드를 끝까지 한 바퀴: 폰은 접힘 → 위로(펼침) → 한 번 더 위로(메트로놈만 크게 — 헤더 왼쪽 버튼으로도) → 아래로 → 한 번 더 아래로(접힘).
  // 넓은 화면은 펼침 → 위로(크게) → 아래로. 밀기 표시는 헤더 가운데(박 점들) — 왼쪽 ♩80 을 밀면 카드가 아니라 빠르기가 바뀐다
  { key: 'metro', target: () => [q('metro-card')], pad: 4, radius: 18, open: true, task: true,
    view: () => {
      const wide = !isPhoneLayout(), st = metroState(), hdr = (): HTMLElement => q('metro-hdr')
      if (done) return snap && settingsStore.get().bpm !== snap.set.bpm // 접은 뒤엔 ♩ 숫자를 밀어 보게 — 밀었으면 되돌아간다고 알린다(기준음과 같은 말)
        ? { title: 'tour.bpmDone', body: 'tour.bpmDoneBody', gesture: 'none', vars: { bpm: snap.set.bpm } }
        : { title: 'tour.metroDone', body: 'tour.metroDoneBody', gesture: 'drag', pulseAt: () => q('metro-hdr-label') }
      if (st === 'f') return { title: 'tour.metroFull', body: 'tour.metroFullBody', gesture: 'swipeDown', pulseAt: hdr }
      if (sawFull) return { title: 'tour.metroDown', body: 'tour.metroDownBody', gesture: 'swipeDown', pulseAt: hdr } // 폰: 펼침까지 내려왔다
      if (st === 'c' || wide) return { title: 'tour.metro', body: wide ? 'tour.metroBodyWide' : 'tour.metroBody', gesture: 'swipeUp', pulseAt: hdr }
      return { title: 'tour.metroMore', body: 'tour.metroMoreBody', gesture: 'swipeUp', pulseAt: hdr }
    } },
  { key: 'rec', target: () => [q('rec-hdr-btn')], pad: 6, radius: 10,
    view: () => ({ title: 'tour.rec', body: 'tour.recBody', gesture: 'none' }) },
  { key: 'menu', target: () => [q('menu-btn'), q('hdr-timer')], pad: 4, radius: 12, // 타이머가 돌고 있으면 헤더의 타이머 막대도 메뉴로 간다
    view: () => ({ title: 'tour.menu', body: 'tour.menuBody', gesture: 'none' }) },
  { key: 'gear', target: () => [q('settings-hdr-btn')], pad: 4, radius: 12,
    view: () => ({ title: 'tour.gear', body: 'tour.gearBody', gesture: 'none' }) },
  { key: 'end',
    view: () => ({ title: 'tour.end', body: 'tour.endBody', gesture: 'none' }) },
]
const LAST = STEPS.length - 1

// ── 레이어 ──
interface Layer { box: HTMLElement; spot: HTMLElement; blocks: HTMLElement[]; cover: HTMLElement; pulse: HTMLElement; card: HTMLElement; caret: HTMLElement; title: HTMLElement; body: HTMLElement; icon: HTMLImageElement; dots: HTMLElement; prev: HTMLButtonElement; next: HTMLButtonElement; skip: HTMLButtonElement; hint: HTMLElement }
let L: Layer | null = null
const el = (tag: string, cls: string, parent?: HTMLElement): HTMLElement => { const e = document.createElement(tag); e.className = cls; parent?.appendChild(e); return e }
const CLOSE_GLYPH = '<svg class="nav-glyph" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>'

function build(): Layer {
  const box = el('div', 'tour'); box.id = 'tour'
  const spot = el('div', 'tour-spot', box)
  const blocks = [0, 1, 2, 3].map(() => el('div', 'tour-block', box))
  const cover = el('div', 'tour-block', box) // 보여 주기만 하는 단계: 구멍 위에도 막(투명)
  const pulse = el('div', 'tour-pulse', box); el('i', '', pulse); el('i', '', pulse)
  const card = el('div', 'tour-card', box); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-live', 'polite'); card.tabIndex = -1
  const caret = el('div', 'tour-caret', card)
  const icon = el('img', 'tour-icon', card) as HTMLImageElement; icon.src = 'icons/icon-192.png'; icon.alt = ''
  const title = el('div', 'tour-title', card), body = el('div', 'tour-body', card)
  const foot = el('div', 'tour-foot', card), dots = el('div', 'tour-dots', foot), btns = el('div', 'tour-btns', foot)
  for (let k = 0; k < LAST; k++) el('i', '', dots) // 마지막 장(시작하기)은 점이 없다
  dots.setAttribute('role', 'img')
  const prev = el('button', 'tour-prev', btns) as HTMLButtonElement, next = el('button', 'tour-next', btns) as HTMLButtonElement
  const skip = el('button', 'tour-skip', card) as HTMLButtonElement; skip.innerHTML = CLOSE_GLYPH
  on(prev, 'click', () => go(i - 1))
  on(next, 'click', () => { if (i === LAST) finish(); else go(i + 1) })
  on(skip, 'click', finish)
  // 막을 누르면: 뒤의 버튼에 닿지 않게 막고(포커스도), "다음"을 살짝 흔들어 어디를 누를지 알려 준다
  for (const b of [...blocks, cover]) on(b, 'pointerdown', (e: PointerEvent) => { e.preventDefault(); nudge() })
  document.body.appendChild(box)
  const hint = el('span', 'tour-skip-hint', card) // 첫 장에서만: × 를 가리키는 말풍선(말풍선 위, 밝힌 곳과의 틈에 뜬다)
  return { box, spot, blocks, cover, pulse, card, caret, title, body, icon, dots, prev, next, skip, hint }
}
function nudge(): void {
  if (!L || reduced()) return
  const b = L.next; b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge')
}

// ── 시작 · 끝 ──
/** 안내를 연다(설정의 '다시 보기'도 여기). onDone: 끝나거나 그만두면 한 번 */
function startTour(onDone?: () => void): void {
  if (active) return
  autoArmed = false
  onFinish = onDone ?? null
  wasFull = metroStore.get().full
  if (wasFull) metroStore.set({ full: false })
  active = true; i = 0; enter()
  if (!L) L = build()
  const box = L.box; box.classList.remove('hide', 'moving')
  last = ''; wasHidden = false
  render(); loop()
  requestAnimationFrame(() => { if (!active) return; box.classList.add('in'); focusCard() })
}
export const tourActive = (): boolean => active
/** 그만두기 (× · Esc · 안드로이드 뒤로) */
export function endTour(): void { finish() }

function finish(): void {
  if (!active) return
  leave(); active = false
  if (wasFull && !metroStore.get().full) metroStore.set({ full: true })
  if (L) { L.box.classList.remove('in'); L.pulse.className = 'tour-pulse' } // 숨은 레이어에서 도는 애니메이션도 멈춘다
  setInert(false)
  restoreBar()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
  const f = onFinish; onFinish = null; f?.()
}

// ── 단계 이동: 떠날 때 그 단계에서 켠 것을 되돌리고, 들어올 때 지금 모습을 적어 둔다 ──
let moveTimer: ReturnType<typeof setTimeout> | null = null
function go(n: number): void {
  if (n < 0 || n > LAST || !L) return
  leave(); i = n; enter()
  // 구멍·말풍선이 다음 자리로 미끄러진다 — 단계를 옮길 때만. 같은 단계 안에서(카드가 커질 때)는 손을 바로 따라간다
  if (!reduced()) { L.box.classList.add('moving'); if (moveTimer) clearTimeout(moveTimer); moveTimer = setTimeout(() => L?.box.classList.remove('moving'), 420) }
  render(true)
}
function enter(): void {
  done = false; sawFull = false; noteRun = 0
  if (STEPS[i]!.key === 'drone') skipDroneHint() // 드론 창의 첫 안내 토스트와 같은 말 — 겹쳐 뜨지 않게
  const s = settingsStore.get()
  const m = metroStore.get()
  snap = { set: { refHz: s.refHz, bpm: s.bpm, timeSig: s.timeSig, subDiv: s.subDiv, metroVol: s.metroVol }, refTone: refToneStore.get().active, drone: droneStore.get().pitchClass, metroPlaying: m.playing, collapsed: m.collapsed, full: m.full }
}
/** restart: 그 단계에서 꺼진 드론·메트로놈을 다시 켠다(버튼을 누른 뒤에만 — 앱이 뒤로 갈 때는 앱이 어차피 다 끈다) */
function leave(restart = true): void {
  const s = snap; if (!s) return
  leaving = true
  try {
    const cur = settingsStore.get(), back: Partial<Settings> = {}
    for (const k of KEEP) if (k !== 'timeSig' && k !== 'subDiv' && cur[k] !== s.set[k]) (back as Record<string, unknown>)[k] = s.set[k]
    if (Object.keys(back).length) settingsStore.set(back)
    // 박자·세분은 메트로놈 명령으로 — 그래야 울리고 있는 클릭 패턴도 같이 돌아간다
    if (settingsStore.get().timeSig !== s.set.timeSig) setTimeSig(s.set.timeSig)
    if (settingsStore.get().subDiv !== s.set.subDiv) setSubDiv(s.set.subDiv)
    if (refToneStore.get().active && !s.refTone) stopRefNote()
    const pc = droneStore.get().pitchClass
    if (pc !== s.drone) { if (s.drone === null) stopDrone(); else if (restart) startDrone(s.drone) }
    const playing = metroStore.get().playing
    if (playing && !s.metroPlaying) stopMetro()
    else if (!playing && s.metroPlaying && restart) toggleMetro()
    const m = metroStore.get()
    if (m.collapsed !== s.collapsed || m.full !== s.full) metroStore.set({ collapsed: s.collapsed, full: s.full })
  } finally { leaving = false; snap = null }
}

// ── 해 보면 설명이 바뀐다: 상태를 보고 판단한다 ──
function check(): void {
  if (!active || leaving) return
  const k = STEPS[i]!.key
  if (k === 'note' && !done) { noteRun = tunerStore.get().hz > 0 ? noteRun + 1 : 0; if (noteRun >= 25) done = true } // 약 0.6 s 이어진 음
  if (k === 'ref' && !done && snap && settingsStore.get().refHz !== snap.set.refHz) done = true
  if (k === 'metro' && !done) {
    const st = metroState()
    if (st === 'f') sawFull = true
    else if (sawFull && st === (isPhoneLayout() ? 'c' : 'e')) done = true // 크게 본 뒤 처음 모습으로 돌아왔다
  }
  const v = STEPS[i]!.view()
  if (`${v.title}|${v.body}` !== shown) render(true) // 설명이 바뀔 때만 (폰의 펼침 → 펼침2 처럼 단계 안에서도)
}

// ── 그리기 ──
let shown = ''
function render(swap = false): void {
  if (!L || !active) return
  const s = STEPS[i]!, v = s.view()
  shown = `${v.title}|${v.body}`
  L.title.textContent = t(v.title, v.vars); L.body.textContent = t(v.body, v.vars)
  L.card.setAttribute('aria-label', L.title.textContent)
  if (swap && !reduced()) { for (const e of [L.title, L.body]) { e.classList.remove('swap'); void e.offsetWidth; e.classList.add('swap') } }
  L.prev.textContent = t('tour.prev'); L.prev.hidden = i === 0 || i === LAST
  L.next.textContent = i === LAST ? t('tour.start') : t('tour.next')
  L.next.classList.toggle('soft', !!s.task && !done)
  L.skip.setAttribute('aria-label', t('tour.skip')); L.skip.hidden = i === LAST
  L.card.classList.toggle('end', i === LAST); L.icon.hidden = i !== LAST
  L.hint.textContent = t('tour.skipHint'); L.hint.hidden = i !== 0
  Array.from(L.dots.children).forEach((d, k) => d.classList.toggle('on', k === i)) // 지금 점이 길어지며 옮겨 간다
  L.dots.setAttribute('aria-label', t('tour.progress', { n: Math.min(i + 1, LAST), total: LAST }))
  L.pulse.className = 'tour-pulse g-' + v.gesture
  layout(true)
  if (swap) focusCard()
}

/** 화면 좌표의 밝힐 자리. 여러 요소면 감싸는 상자. 숨은 요소(타이머가 안 돌 때의 막대)는 뺀다 */
function holeRect(s: Step): DOMRect | null {
  const els = s.target?.().filter(e => e && e.offsetParent !== null) ?? []
  if (!els.length) return null
  const rs = els.map(e => e.getBoundingClientRect()), p = s.pad ?? 6
  const x0 = Math.min(...rs.map(r => r.left)) - p, y0 = Math.min(...rs.map(r => r.top)) - p
  const x1 = Math.max(...rs.map(r => r.right)) + p, y1 = Math.max(...rs.map(r => r.bottom)) + p
  return new DOMRect(x0, y0, x1 - x0, y1 - y0)
}
/** 안전 영역(노치·홈 막대) — 말풍선이 그 안으로 들어가지 않게 */
let insets = { top: 0, bottom: 0 }
function measureInsets(): void {
  const p = document.createElement('div'); p.style.cssText = 'position:fixed;visibility:hidden;top:0;left:0;height:env(safe-area-inset-top,0px);width:env(safe-area-inset-bottom,0px)'
  document.body.appendChild(p); insets = { top: p.offsetHeight, bottom: p.offsetWidth }; p.remove()
}

/** 뒤의 앱(#app)을 비활성 — 막이 손가락은 막지만 키보드 Tab·스크린 리더는 막지 못한다 */
let inertOn = false
function setInert(v: boolean): void { if (v === inertOn) return; inertOn = v; q('app').toggleAttribute('inert', v) }
/** 지금 단계에서 밝혀 둔(누를 수 있는) 요소 안인가 */
const inHole = (e: EventTarget | null): boolean => { const s = STEPS[i]!; return !!s.open && e instanceof Node && !!s.target?.().some(x => x.contains(e)) }

let last = '', wasHidden = false
function layout(force = false): void {
  if (!L) return
  const s = STEPS[i]!, v = s.view(), vw = window.innerWidth, vh = window.innerHeight
  const hidden = overlayOpen() || isEditorOpen()
  if (hidden !== wasHidden) { wasHidden = hidden; L.box.classList.toggle('hide', hidden); force = true }
  if (hidden) { restoreBar(); setInert(false); return }
  setInert(!s.open) // 보여 주기만 하는 단계: 키보드·스크린 리더로도 뒤의 버튼(REC 등)에 닿지 않게
  const h = holeRect(s)
  const cw = L.card.offsetWidth, ch = L.card.offsetHeight
  const key = `${vw}|${vh}|${h ? [h.x, h.y, h.width, h.height].map(Math.round).join(',') : '-'}|${cw}|${ch}|${i}|${sawFull}|${done}`
  if (key === last && !force) return
  last = key
  dimBar()
  // 구멍 (그림자가 곧 어두운 막). 마지막 장은 구멍 없이 막만
  if (h) Object.assign(L.spot.style, { left: h.x + 'px', top: h.y + 'px', width: h.width + 'px', height: h.height + 'px', borderRadius: (s.radius ?? 12) + 'px' })
  else Object.assign(L.spot.style, { left: vw / 2 + 'px', top: vh / 2 + 'px', width: '0px', height: '0px', borderRadius: '0px' })
  L.spot.classList.toggle('none', !h)
  // 구멍 밖은 못 누른다 — 보이지 않는 네 장. 보여 주기만 하는 단계는 구멍 위에도 한 장
  const r = h ?? new DOMRect(vw / 2, vh / 2, 0, 0)
  const set = (b: HTMLElement, x: number, y: number, w: number, hh: number): void => { Object.assign(b.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, hh) + 'px' }) }
  set(L.blocks[0]!, 0, 0, vw, r.top); set(L.blocks[1]!, 0, r.bottom, vw, vh - r.bottom)
  set(L.blocks[2]!, 0, r.top, r.left, r.height); set(L.blocks[3]!, r.right, r.top, vw - r.right, r.height)
  if (h && !s.open) set(L.cover, r.left, r.top, r.width, r.height); else set(L.cover, 0, 0, 0, 0)
  // 해 볼 곳 표시 (탭 = 퍼지는 고리, 밀기 = 위·아래로 가는 점)
  const pe = v.gesture !== 'none' ? v.pulseAt?.() : null, pr0 = pe?.getBoundingClientRect(), pr = pr0 && pr0.width > 0 ? pr0 : undefined // 숨은 요소는 (0,0) 에 0 크기
  if (pr) {
    const px = v.gesture === 'drag' ? pr.right : pr.left + pr.width / 2 // 기준음 드럼: 숫자를 가리지 않게 오른쪽 가장자리에서
    Object.assign(L.pulse.style, { left: px + 'px', top: pr.top + pr.height / 2 + 'px', display: '' })
  }
  else L.pulse.style.display = 'none'
  // 말풍선 자리는 core/tourPlace.ts 가 정한다
  const gap = L.hint.hidden ? 0 : L.hint.offsetHeight + 8 // 첫 장: × 말풍선이 밝힌 곳을 가리지 않게 그만큼 아래로
  const { x, y, place, caret } = placeBubble({ hole: h, vw, vh, insetTop: insets.top, insetBottom: insets.bottom, cw, ch, hintGap: gap, hasPulse: !!pr })
  Object.assign(L.card.style, { left: x + 'px', top: y + 'px' })
  L.card.classList.toggle('up', place === 'above')
  L.card.classList.toggle('side-l', place === 'left'); L.card.classList.toggle('side-r', place === 'right')
  L.caret.style.display = place === 'none' ? 'none' : ''
  if (caret.side) { L.caret.style.left = ''; L.caret.style.top = caret.at + 'px' }
  else { L.caret.style.top = ''; L.caret.style.left = caret.at + 'px' }
}

/** 자리를 매 프레임 잰다 — 메트로놈 카드가 커지는 동안·화면을 돌리는 동안에도 구멍이 따라간다. 바뀐 게 없으면 아무것도 안 한다 */
function loop(): void {
  if (!active) return
  layout(); requestAnimationFrame(loop)
}

// ── 상태바: 막이 떠 있는 동안 상태바도 같이 어둡게(홈 화면 앱·안드로이드는 theme-color · 상태바 색을 따라온다) ──
/** 토큰 색 → [r, g, b, a]. 브라우저가 rgb()/rgba() 로 풀어 준 값을 읽는다 — 토큰은 #rgb·#rrggbbaa·rgba() 어느 꼴로 써도 된다 */
function rgba(token: string): number[] {
  const p = document.createElement('i'); p.style.cssText = `position:fixed;visibility:hidden;color:var(${token})`
  document.body.appendChild(p); const c = getComputedStyle(p).color; p.remove()
  const v = c.match(/[\d.]+/g)?.map(Number) ?? []
  return v.length === 3 ? [...v, 1] : v
}
let dimmed = false
function dimBar(): void {
  if (dimmed) return
  const bg = rgba('--bg'), sc = rgba('--scrim')
  if (bg.length < 3 || sc.length < 4) return
  const a = sc[3]!, mix = bg.slice(0, 3).map((v, k) => Math.round(v * (1 - a) + sc[k]! * a))
  setStatusBarTheme(settingsStore.get().theme, '#' + mix.map(v => v.toString(16).padStart(2, '0')).join(''))
  dimmed = true
}
function restoreBar(): void {
  if (!dimmed) return
  dimmed = false
  setStatusBarTheme(settingsStore.get().theme, getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
}

/** 처음 실행이면 튜너가 켜진 뒤 띄운다. 설정의 '다시 보기'도 여기서 묶는다 */
export function mountTour(o: { pending: boolean; onDone: () => void }): void {
  measureInsets(); on(window, 'resize', measureInsets)
  tunerStore.select(s => s.frame, check)
  settingsStore.select(s => s.refHz, check); settingsStore.select(s => s.bpm, check)
  metroStore.select(s => s.collapsed, check); metroStore.select(s => s.full, check)
  onLangChange(() => render())
  settingsStore.select(s => s.theme, () => { if (active && dimmed) { dimmed = false; dimBar() } })
  on(window, 'pointerdown', () => { kbd = false }, { capture: true })
  on(window, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.code === 'Space') kbd = true
    if (!active || wasHidden) return
    if (e.key === 'Escape') { e.preventDefault(); finish(); return }
    // 막 아래의 단축키(Space = 메트로놈)는 막는다 — 말풍선의 버튼과 밝힌 곳의 버튼은 그대로
    if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement && (L?.card.contains(e.target) || inHole(e.target)))) { e.preventDefault(); e.stopImmediatePropagation() }
  }, { capture: true })
  // 앱이 뒤로 가면(꺼질 수도 있다) 그 단계에서 바꾼 것을 먼저 되돌린다 — 설정 자동 저장(persist/settings)보다 먼저 돌도록 capture.
  // 돌아오면 같은 단계를 처음부터
  const away = (): void => { if (!active || !snap) return; leave(false); enter(); render() }
  on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') away() }, { capture: true })
  on(window, 'pagehide', away, { capture: true })
  // 설정 › 처음 안내 › 다시 보기: 설정이 닫히는 걸 보고 연다
  on(q('tour-replay-btn'), 'click', () => { closeSettings(); setTimeout(() => startTour(o.onDone), 260) })
  if (!o.pending) return
  // 튜너가 처음 켜지면 — 화면이 자리 잡은 뒤(폰은 메트로놈이 250 ms 뒤 접힌다). 마이크가 켜질 때까지 기다린다(그 전에 다시 보기로 열었다 닫았으면 안 띄운다)
  autoArmed = true
  tunerStore.select(s => s.micReady, ready => { if (ready && autoArmed) setTimeout(() => { if (autoArmed) startTour(o.onDone) }, 900) }, { immediate: true })
}
