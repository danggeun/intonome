/** 설정 맨 아래: 개인정보처리방침 · 문의 · 오픈소스 라이선스. 방침·라이선스는 앱 안 화면(글꼴 OFL 은 전문이 함께 가야 하고, 방침은 앱 밖으로 튀어 나가면 당황스럽다 — 피드백). 문의만 메일 앱 */
import { q, on } from './dom.ts'
import { attachSwipeBack } from './swipeBack.ts'
import { getLang, type Lang } from '../core/i18n/index.ts'
import { CONTACT_URL } from '../core/links.ts'
import { licensesText } from './licensesText.ts'
import { onLangChange } from './lang.ts'

type Doc = 'privacy' | 'licenses'
const page = (d: Doc): HTMLElement => q(`${d}-page`)
export const isDocOpen = (): boolean => page('privacy').classList.contains('open') || page('licenses').classList.contains('open')
/** 열린 문서 화면을 닫는다(맨 위 하나). 없으면 false */
export function closeDoc(): boolean {
  for (const d of ['privacy', 'licenses'] as const) if (page(d).classList.contains('open')) { page(d).classList.remove('open'); return true }
  return false
}
function openDoc(d: Doc): void {
  if (d === 'licenses') { const pre = q('licenses-text'); if (!pre.textContent) pre.textContent = licensesText() } // 처음 열 때 한 번
  else { const box = q('privacy-text'); const lang = getLang(); if (box.dataset.lang !== lang) { box.innerHTML = privacyHtml(lang); box.dataset.lang = lang } }
  page(d).classList.add('open'); page(d).scrollTop = 0
}

/** PRIVACY.md(vite define `__PRIVACY_MD__`; `---` 로 나뉜 영어 → 한국어 → 일본어 → 중국어 간체 → 번체 → 스페인어 절)를 한 언어만 골라 HTML 로. 마크다운 중 그 파일이 쓰는 것만: `#`·`##` 제목, `-` 목록, `**굵게**`, `<주소>`, `*기울임*` 없음 */
const PRIVACY_PART: Record<Lang, number> = { en: 0, ko: 1, ja: 2, 'zh-Hans': 3, 'zh-Hant': 4, es: 5 }
export function privacyHtml(lang: Lang): string {
  const parts = __PRIVACY_MD__.split(/\n---\n/)
  const md = parts[PRIVACY_PART[lang]] ?? parts[0] ?? __PRIVACY_MD__
  const esc = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (t: string): string => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\s*·\s*\[[^\]]+\]\(#[^)]*\)/g, '') // 영/한 건너뛰기 링크는 뺀다(화면은 한 언어만)
  const out: string[] = []; let list: string[] = []; let first = true
  const flush = (): void => { if (list.length) { out.push(`<ul>${list.join('')}</ul>`); list = [] } }
  for (const raw of md.split('\n')) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    if (line.startsWith('# ')) continue // 문서 제목은 화면 제목이 대신한다
    if (line.startsWith('## ')) { flush(); out.push(`<h3>${inline(line.slice(3))}</h3>`); continue }
    if (line.startsWith('- ')) { list.push(`<li>${inline(line.slice(2))}</li>`); continue }
    flush()
    if (first) { out.push(`<p class="doc-meta">${inline(line)}</p>`); first = false } // '최종 수정일' 줄
    else out.push(`<p>${inline(line)}</p>`)
  }
  flush(); return out.join('')
}

/** 맨 아래 세 링크의 배열(사용자 결정 2026-11-05): 영어·일본어는 세로 3줄 — 한 줄이면 영어는 간당간당하고 일본어(약 380 px)는 넘친다; 한국어·중국어는 한 줄(약 190~250 px, 균형이 맞는다). 폰마다 다르지 않게 언어로 못 박고, 그래도 안 들어가면(낯선 글꼴) 세로로 */
const STACKED: ReadonlySet<Lang> = new Set(['en', 'ja', 'es']) // 스페인어도 세 항목 약 330 px 라 세로
function layoutLinks(): void {
  const row = q('settings-links'); row.classList.remove('stack')
  if (STACKED.has(getLang())) { row.classList.add('stack'); return }
  const items = [...row.querySelectorAll<HTMLElement>('a, button, .sl-dot')]
  const need = items.reduce((w, el) => w + el.getBoundingClientRect().width, 0) // 점의 양옆 여백은 점 자신의 padding — 폭에 들어 있다
  if (need > row.clientWidth) row.classList.add('stack')
}

export function mountAbout(): void {
  q<HTMLAnchorElement>('contact-link').href = CONTACT_URL // mailto 는 새 창 없이: 페이지를 떠나지 않고 메일 앱만 열리며, _blank 를 주면 빈 탭이 남는 브라우저가 있다
  on(q('privacy-btn'), 'click', () => openDoc('privacy'))
  on(q('licenses-btn'), 'click', () => openDoc('licenses'))
  for (const d of ['privacy', 'licenses'] as const) {
    on(q(`${d}-close-btn`), 'click', () => page(d).classList.remove('open'))
    attachSwipeBack(page(d), { onBack: () => page(d).classList.remove('open') })
  }
  onLangChange(layoutLinks); on(window, 'resize', layoutLinks); on(q('settings-hdr-btn'), 'click', layoutLinks); layoutLinks() // 설정을 열 때 한 번 더 — 글꼴이 늦게 와서 처음 잰 폭이 다를 수 있다
}
