/** 설정 맨 아래: 개인정보처리방침 · 오픈소스 라이선스 · 문의. 라이선스는 앱 안 화면으로(글꼴 OFL 은 전문이 함께 가야 한다) */
import { q, on } from './dom.ts'
import { attachSwipeBack } from './swipeBack.ts'
import { isNative } from '../platform/index.ts'
import { PRIVACY_URL, CONTACT_URL } from '../core/links.ts'
import { licensesText } from './licensesText.ts'

export const isLicensesOpen = (): boolean => q('licenses-page').classList.contains('open')
export function closeLicenses(): void { q('licenses-page').classList.remove('open') }
function openLicenses(): void {
  const pre = q('licenses-text'); if (!pre.textContent) pre.textContent = licensesText() // 처음 열 때 한 번
  q('licenses-page').classList.add('open'); q('licenses-page').scrollTop = 0
}

export function mountAbout(): void {
  const privacy = q<HTMLAnchorElement>('privacy-link'), contact = q<HTMLAnchorElement>('contact-link')
  privacy.href = PRIVACY_URL; contact.href = CONTACT_URL
  // 웹(특히 홈 화면 웹앱)에서는 새 창으로 — 같은 창에서 열면 뒤로 갈 길이 없는 화면이 된다. 앱(WebView)은 바깥 주소를 그대로 가게 두면 Capacitor 가 브라우저로 넘긴다.
  // mailto 는 새 창 없이: 페이지를 떠나지 않고 메일 앱만 열리며, _blank 를 주면 빈 탭이 남는 브라우저가 있다
  if (!isNative()) { privacy.target = '_blank'; privacy.rel = 'noopener' }
  on(q('licenses-btn'), 'click', openLicenses)
  on(q('licenses-close-btn'), 'click', closeLicenses)
  attachSwipeBack(q('licenses-page'), { onBack: closeLicenses })
}
