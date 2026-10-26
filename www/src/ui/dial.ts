/**
 * 전용 모드 다이얼 — 링을 돌린 만큼(상대 회전) BPM 이 변한다. 수학은 core/metro/dial.ts.
 * SVG 는 한 번 만들고 BPM 이 바뀌면 바늘·채움 호만 움직인다. 가운데 숫자·용어는 HTML — 앱 글꼴과 같아야 해서
 */
import { bpmToAngle, degPerBpm, angleDelta, pointToAngle, polar, arcPath, tempoName, ARC_LABELS, dialTypography } from '../core/metro/dial.ts'
import { CFG } from '../state/index.ts'
import { q, on } from './dom.ts'

const NS = 'http://www.w3.org/2000/svg'
// viewBox 320 기준 반지름: 링·채움·바늘 112, 눈금 시작 119, 숫자 133, 템포 이름(링 안쪽) 94
const C = 160, R_RING = 112, R_TICK0 = 119, R_NUM = 133, R_NAME = 94
const A0 = -135, A1 = 135

/** 숫자를 눈금 바깥쪽으로 붙인다 — 중심에서 본 방향에 따라 정렬점을 바꾼다 */
function outwardAnchor(deg: number): { anchor: string; baseline: string } {
  const a = (deg * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a)
  return {
    anchor: dx > 0.35 ? 'start' : dx < -0.35 ? 'end' : 'middle',
    baseline: dy > 0.35 ? 'hanging' : dy < -0.35 ? 'alphabetic' : 'central',
  }
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  return e
}

let fill: SVGPathElement, needle: SVGCircleElement, built = false

export function buildDial(): void {
  if (built) return
  built = true
  const { bpmMin: min, bpmMax: max } = CFG.metro
  const svg = q<HTMLElement>('dial-svg') as unknown as SVGSVGElement
  svg.setAttribute('viewBox', '0 0 320 320')

  // 트랙
  svg.appendChild(el('path', { d: arcPath(C, C, R_RING, A0, A1), class: 'dial-track' }))
  // 눈금 + 숫자
  for (let b = min; b <= max; b += 5) {
    const a = bpmToAngle(b, min, max), major = b % 20 === 0
    const p0 = polar(C, C, R_TICK0, a), p1 = polar(C, C, R_TICK0 + (major ? 9 : 5), a)
    svg.appendChild(el('line', { x1: p0.x.toFixed(2), y1: p0.y.toFixed(2), x2: p1.x.toFixed(2), y2: p1.y.toFixed(2), class: major ? 'dial-tick major' : 'dial-tick' }))
    if (major) {
      const pn = polar(C, C, R_NUM, a), { anchor, baseline } = outwardAnchor(a)
      const t = el('text', { x: pn.x.toFixed(2), y: pn.y.toFixed(2), class: 'dial-num', 'text-anchor': anchor, 'dominant-baseline': baseline })
      t.textContent = String(b); svg.appendChild(t)
    }
  }
  // 템포 이름 — 링 안쪽 호를 따라, 구간 가운데 정렬
  const defs = el('defs', {}); svg.appendChild(defs)
  ARC_LABELS.forEach(([name, from, to], i) => {
    const id = `dial-arc-${i}`
    defs.appendChild(el('path', { id, d: arcPath(C, C, R_NAME, bpmToAngle(from, min, max), bpmToAngle(to, min, max)) }))
    const t = el('text', { class: 'dial-name' })
    const tp = el('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' })
    tp.setAttribute('href', `#${id}`); tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${id}`)
    tp.textContent = name; t.appendChild(tp); svg.appendChild(t)
  })
  // 채움 호 + 바늘점 (맨 위에)
  fill = el('path', { d: '', class: 'dial-fill' }); svg.appendChild(fill)
  needle = el('circle', { cx: C, cy: C, r: 8, class: 'dial-needle' }); svg.appendChild(needle)

  const host = q('dial')
  attachRotate(host)
  attachTypography(host)
}

/** 다이얼 크기는 폰마다 다르고(217~320 px) SVG 글자는 user unit 이라 같이 줄어든다 → 실제 px 를 재서 CSS 변수로 글자 크기를 고정 */
function attachTypography(host: HTMLElement): void {
  const apply = (px: number): void => {
    if (!(px > 0)) return // display:none(전용 모드 밖)이면 0 — 마지막 값을 유지
    const t = dialTypography(px)
    host.style.setProperty('--dial-px', px.toFixed(1))
    host.style.setProperty('--dial-num-units', t.numUnits.toFixed(2))
    host.style.setProperty('--dial-name-units', t.nameUnits.toFixed(2))
    host.classList.toggle('no-names', !t.showNames)
  }
  if (typeof ResizeObserver === 'undefined') { apply(host.getBoundingClientRect().width); return } // 아주 옛 브라우저 — 한 번만
  new ResizeObserver(entries => { for (const e of entries) apply(e.contentRect.width) }).observe(host)
}

/** BPM → 바늘·채움·숫자·용어 */
export function setDialBpm(bpm: number): void {
  if (!built) return
  const { bpmMin: min, bpmMax: max } = CFG.metro
  const a = bpmToAngle(bpm, min, max), p = polar(C, C, R_RING, a)
  needle.setAttribute('cx', p.x.toFixed(2)); needle.setAttribute('cy', p.y.toFixed(2))
  fill.setAttribute('d', a > A0 + 0.01 ? arcPath(C, C, R_RING, A0, a) : '')
  q('dial-bpm').textContent = String(bpm)
  q('dial-name').textContent = tempoName(bpm)
}

let onChange: ((bpm: number) => void) | null = null
export function onDialChange(fn: (bpm: number) => void): void { onChange = fn }

/** 가운데 숫자(링 반지름의 이 비율 안쪽)에서 시작한 끌기는 회전이 아니라 ↕ — 펼침 카드·처음 안내에서 배운 제스처 그대로.
 * 중심 가까이에서 회전으로 계산하면 10 px 가 16 BPM, 중심을 지나면 끝값으로 튀었다 */
const INNER = 0.55
function attachRotate(host: HTMLElement): void {
  let active = false, lastA = 0, acc = 0, base = 0, vertical = false, startY = 0
  const center = () => { const r = host.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ring: r.width / 2 * (R_RING / C) } }
  on(host, 'pointerdown', (e: PointerEvent) => {
    active = true; acc = 0; base = +q('dial-bpm').textContent!
    const c = center(); lastA = pointToAngle(e.clientX - c.x, e.clientY - c.y)
    vertical = Math.hypot(e.clientX - c.x, e.clientY - c.y) < c.ring * INNER; startY = e.clientY
    host.setPointerCapture(e.pointerId); e.preventDefault()
  })
  on(host, 'pointermove', (e: PointerEvent) => {
    if (!active) return
    const { bpmMin: min, bpmMax: max } = CFG.metro, dpb = degPerBpm(min, max)
    if (vertical) { const next = Math.max(min, Math.min(max, base + Math.round((startY - e.clientY) / CFG.metro.swipePxPerBpm))); if (onChange && next !== +q('dial-bpm').textContent!) onChange(next); return }
    const c = center(), a = pointToAngle(e.clientX - c.x, e.clientY - c.y)
    acc += angleDelta(lastA, a); lastA = a
    acc = Math.max((min - base) * dpb, Math.min((max - base) * dpb, acc)) // 끝에서 멈춘다 — 넘겨 돌린 만큼을 되감을 필요가 없다
    const next = Math.round(base + acc / dpb)
    if (onChange && next !== +q('dial-bpm').textContent!) onChange(next)
  })
  const end = () => { active = false }
  on(host, 'pointerup', end); on(host, 'pointercancel', end)
  // 키보드: ↑/→ +1, ↓/← −1, PageUp/Down ±5, Home/End 끝값
  on(host, 'keydown', (e: KeyboardEvent) => {
    const { bpmMin: min, bpmMax: max } = CFG.metro, cur = +q('dial-bpm').textContent!
    const step = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : e.key === 'PageUp' ? 5 : e.key === 'PageDown' ? -5 : e.key === 'Home' ? min - cur : e.key === 'End' ? max - cur : 0
    if (!step) return
    e.preventDefault(); const next = Math.max(min, Math.min(max, cur + step)); if (onChange && next !== cur) onChange(next)
  })
}
