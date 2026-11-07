import { q } from './dom.ts'

/** 동시에 쌓아 둘 최대 개수 — 그 이상은 화면을 덮는다 */
const MAX_TOASTS = 3
/** 페이드아웃 시간 (style.css 의 .toast transition 과 같아야 한다) */
const FADE_MS = 260

type Slot = { el: HTMLElement; timer: ReturnType<typeof setTimeout>; msg: string; actionable: boolean }
const slots: Slot[] = []

/** 넘칠 때 내보낼 인덱스 — 액션 없는 가장 오래된 것 우선(액션 토스트는 놓치면 데이터가 사라진다), 전부 액션이면 가장 오래된 것 */
export function evictIndex(actionable: readonly boolean[]): number {
  if (!actionable.length) return -1
  const i = actionable.indexOf(false)
  return i >= 0 ? i : 0
}

function markLatest(): void {
  // 가장 최근 토스트가 #toast — e2e 선택자가 "지금 뜬 토스트" 를 가리킨다
  for (const s of slots) s.el.removeAttribute('id')
  const last = slots[slots.length - 1]
  if (last) last.el.id = 'toast'
}

function drop(s: Slot): void {
  const i = slots.indexOf(s)
  if (i < 0) return
  clearTimeout(s.timer); slots.splice(i, 1)
  s.el.classList.remove('show', 'actionable'); s.el.onclick = null
  setTimeout(() => s.el.remove(), FADE_MS)
  markLatest()
}

type Held = { msg: string; ms: number; action?: () => void }
/** 숨김 중에 온 안내를 모은다 — 같은 글(액션 없음)은 하나로, 늦게 온 쪽의 시간으로. 순수 */
export function holdNotice(held: readonly Held[], h: Held): Held[] {
  if (!h.action) { const i = held.findIndex(x => x.msg === h.msg && !x.action); if (i >= 0) return held.map((x, k) => k === i ? h : x) }
  return [...held, h]
}
// 숨김 중에는 띄우지 않고 모아 두었다가 돌아오면 띄운다. 숨김 중엔 rAF 가 돌지 않아 보이지도 않은 채 시간만 흘러 사라졌다
// (안드로이드 앱: 전원 버튼 → 녹음 저장 실패 안내가 뒤에서 사라지고 돌아오면 '저장했어요' 만 보였다)
let held: Held[] = []
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { // typeof: 단위 테스트(node)가 이 모듈의 순수 함수를 읽는다
  if (document.visibilityState !== 'visible' || !held.length) return
  const xs = held; held = []
  for (const h of xs) toast(h.msg, h.ms, h.action)
})

/** 토스트. action 이 있으면 토스트를 탭할 때 실행된다 (예: 삭제 실행 취소) */
export function toast(msg: string, ms = 2500, action?: () => void): void {
  if (document.visibilityState === 'hidden') { held = holdNotice(held, action ? { msg, ms, action } : { msg, ms }); return }
  // 같은 안내가 연달아 오면 시간만 연장. 액션 토스트는 각각 다른 항목을 되살리므로 제외
  if (!action) {
    const same = slots.find(s => s.msg === msg && !s.actionable)
    if (same) { clearTimeout(same.timer); same.timer = setTimeout(() => drop(same), ms); return }
  }
  const host = q('toast-host')
  // 누를 수 있는 안내(실행 취소·눌러서 듣기)는 진짜 버튼 — 화면 읽기·키보드로 닿고, 키보드 포커스·마우스가 올라가 있는 동안은 사라지지 않는다.
  // 시간은 부른 쪽이 정한 그대로(실행 취소 5 초). 2.9.3 의 '최소 7 초' 는 폰에서 너무 오래 떠 있었다
  const el = document.createElement(action ? 'button' : 'div')
  el.className = 'toast'; el.textContent = msg
  if (action) el.classList.add('actionable')
  const slot: Slot = { el, timer: setTimeout(() => drop(slot), ms), msg, actionable: !!action }
  el.onclick = action ? () => { action(); drop(slot) } : null
  if (action) {
    const hold = (): void => clearTimeout(slot.timer), resume = (): void => { clearTimeout(slot.timer); slot.timer = setTimeout(() => drop(slot), 3000) }
    el.addEventListener('focus', hold); el.addEventListener('blur', resume)
    // 마우스만 — 폰에서는 손가락이 스치기만 해도 pointerenter 가 오고 leave 가 늦거나 안 와서 안내가 멈춰 있을 수 있다
    el.addEventListener('pointerenter', e => { if ((e as PointerEvent).pointerType === 'mouse') hold() }); el.addEventListener('pointerleave', e => { if ((e as PointerEvent).pointerType === 'mouse') resume() })
  }
  host.appendChild(el)
  slots.push(slot); markLatest()
  // 시작값(opacity 0)을 확정한 뒤 .show 로 페이드인
  requestAnimationFrame(() => { if (slots.includes(slot)) el.classList.add('show') }) // 그 사이 drop 됐으면 되살리지 않는다
  while (slots.length > MAX_TOASTS) drop(slots[evictIndex(slots.map(s => s.actionable))]!)
}
