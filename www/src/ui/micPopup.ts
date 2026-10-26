/** 첫 진입 마이크 권한 팝업 */
import { q, on } from './dom.ts'
import { isNative, isIOS } from '../platform/index.ts'
import { t } from '../core/i18n/index.ts'

/** denied=true 면 "차단됨" 안내 문구 */
export function showMicPopup(denied = false): void {
  q('mic-popup-title').textContent = t(denied ? 'mic.titleBlocked' : 'mic.titleOff')
  // 앱에는 주소창이 없다 — 시스템 설정 경로로 안내. 두 번 거부하면 OS 다이얼로그가 다시 뜨지 않는다. 홈 화면 웹앱(standalone)도 주소창이 없다 — 플랫폼별 경로
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const blocked = isNative() ? 'mic.descBlockedNative' : standalone ? (isIOS() ? 'mic.descBlockedIosApp' : 'mic.descBlockedAndroidApp') : 'mic.descBlockedWeb'
  q('mic-popup-desc').innerHTML = t(denied ? blocked : 'mic.descOff') // 사전 문구의 <br> 만 — 사용자 입력은 없다
  q('mic-popup-btn').textContent = t(denied ? 'common.retry' : 'mic.turnOn')
  q('mic-popup-bg').classList.add('show')
}
export const closeMicPopup = (): void => q('mic-popup-bg').classList.remove('show')

let retryFailed: (() => void) | null = null
export function onMicRetryFailed(fn: () => void): void { retryFailed = fn }
export function mountMicPopup(openMic: () => Promise<boolean>): void {
  const btn = q<HTMLButtonElement>('mic-popup-btn')
  on(btn, 'click', async () => {
    btn.textContent = t('mic.connecting'); btn.disabled = true
    if (await openMic()) closeMicPopup()
    else { btn.textContent = t('common.retry'); btn.disabled = false; retryFailed?.() } // 안 되면 말해 준다 — 2.5.7 까지는 글자만 돌아와 아무 일도 없는 듯 보였다
  })
  on(q('mic-popup-cancel'), 'click', closeMicPopup)
}
