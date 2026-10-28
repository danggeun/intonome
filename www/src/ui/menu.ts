/** 풀스크린 메뉴 + 설정 페이지 열기/닫기 */
import { q, qs, on, reflow } from './dom.ts'
import { attachSwipeBack } from './swipeBack.ts'
import { dronePopOpen } from './drone.ts'

function toggleMenu(): void { q('menu-overlay').classList.toggle('open') }
/** 편집기에서 돌아올 때: 트랜지션 없이 즉시 열린 상태로 */
export function showMenuInstant(): void {
  const el = q('menu-overlay'); el.style.transition = 'none'; el.classList.add('open'); reflow(el); el.style.transition = ''
}
export function hideMenu(): void { q('menu-overlay').classList.remove('open') }
export function openMenu(): void { q('menu-overlay').classList.add('open') }
const openSettings = (): void => q('settings-page').classList.add('open')
export const closeSettings = (): void => q('settings-page').classList.remove('open')

/** 화면을 덮고 있는 오버레이가 있는가 — 전역 단축키(Space)는 지금 보이는 화면의 것 */
export const overlayOpen = (): boolean =>
  q('menu-overlay').classList.contains('open') || q('settings-page').classList.contains('open') || q('mic-popup-bg').classList.contains('show') || dronePopOpen()

export function mountMenu(): void {
  on(q('menu-btn'), 'click', toggleMenu)
  on(qs('.menu-close-btn'), 'click', toggleMenu)
  on(q('settings-hdr-btn'), 'click', openSettings)
  on(q('settings-back-btn'), 'click', closeSettings)
  // 가장자리 스와이프 = 뒤로: 메뉴 → 본화면, 설정 → 메뉴
  attachSwipeBack(q('menu-overlay'), { onBack: hideMenu })
  attachSwipeBack(q('settings-page'), { onBack: closeSettings })
  // Esc 도 닫는다 (키보드·스위치 사용자). 열린 것 중 맨 위부터 — 드론 창은 ui/drone, 안내는 ui/tour 가 받는다
  on(window, 'keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (q('settings-page').classList.contains('open')) closeSettings()
    else if (q('menu-overlay').classList.contains('open')) hideMenu()
  })
  // 메뉴·설정·마이크 팝업·편집기가 열려 있는 동안 뒤 화면(헤더·본문)은 inert — 스크린리더·Tab 이 뒤 화면을 돌지 않게.
  // 열리면 포커스를 그 화면(컨테이너)으로 옮긴다 — 버튼에 주면 포커스 링이 그려져 탭으로 연 사람에게 군더더기다
  const behind = [q('hdr'), q('main-body')]
  const layers: Array<[HTMLElement, string, string]> = [[q('menu-overlay'), 'open', '#menu-panel'], [q('settings-page'), 'open', '#settings-inner'], [q('mic-popup-bg'), 'show', '#mic-popup'], [q('editor-page'), 'open', '#ed-inner']]
  let wasOpen = false
  const sync = (): void => {
    const top = [...layers].reverse().find(([el, cls]) => el.classList.contains(cls))
    const open = !!top
    for (const b of behind) b.toggleAttribute('inert', open)
    if (open && !wasOpen) { const f = top![0].querySelector<HTMLElement>(top![2]); if (f && !top![0].contains(document.activeElement)) { f.tabIndex = -1; f.focus({ preventScroll: true }) } }
    wasOpen = open
  }
  const mo = new MutationObserver(sync); for (const [el] of layers) mo.observe(el, { attributes: true, attributeFilter: ['class'] })
  sync()
}
