/** DOM 도우미 — id 조회의 null 체크를 한 곳에서. 없는 id는 프로그래밍 오류이므로 즉시 throw. */
export function q<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} not found`)
  return el as T
}
export function qs<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel)
  if (!el) throw new Error(`${sel} not found`)
  return el
}
export function qsa<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] { return Array.from(root.querySelectorAll<T>(sel)) }
/** 켜짐/선택 표시: 클래스와 aria-pressed 를 같이 — 스크린리더가 "한국어, 버튼" 이 아니라 "눌림" 까지 읽게 */
export function setOn(el: Element, on: boolean): void { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false') }
export function on<K extends keyof HTMLElementEventMap>(el: HTMLElement | Window | Document, type: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions): void { el.addEventListener(type, fn as EventListener, opts) }

/** 강제 리플로우 (CSS 트랜지션의 시작값을 확정할 때) */
export function reflow(el: HTMLElement): void { void el.offsetHeight }

/** 재생 버튼의 그림 — 글꼴의 ▶·■·❚❚ 대신 SVG: 글꼴 글리프는 기기마다 크기·위치가 달라 버튼 가운데에서 벗어나 보였다(아이폰).
 * 24 칸 좌표, 크기는 글꼴 글자(안드로이드 ■ 약 15 칸)에 맞춘다 — 2.7.0 의 12 칸은 작아 보였다(사용자). 재생 삼각형은 무게중심이 왼쪽에 있어 테두리 상자를 오른쪽으로 1.5 칸 밀어 눈에 가운데로 — 정지·일시정지는 좌우 대칭이라 그대로.
 * 정지(■)는 '처음으로', 위치를 유지하는 일시정지는 앱 전체에서 ❚❚ */
export type Glyph = 'play' | 'stop' | 'pause'
const GLYPH_PATH: Record<Glyph, string> = {
  play: '<path d="M5.95 4.4c0-1.1 1.2-1.8 2.1-1.2l12.3 7.3c.9.6.9 1.9 0 2.5L8.05 20.3c-.9.6-2.1-.1-2.1-1.2Z"/>',
  stop: '<rect x="4.5" y="4.5" width="15" height="15" rx="2"/>',
  pause: '<rect x="5.2" y="4" width="4.6" height="16" rx="1.2"/><rect x="14.2" y="4" width="4.6" height="16" rx="1.2"/>',
}
export const glyphSvg = (g: Glyph): string => `<svg class="tp-glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPH_PATH[g]}</svg>`
/** 버튼의 그림을 바꾼다. 어떤 그림인지는 data-glyph 로 남긴다(테스트·스타일) */
export function setGlyph(btn: HTMLElement, g: Glyph): void { if (btn.dataset.glyph !== g) { btn.innerHTML = glyphSvg(g); btn.dataset.glyph = g } }
