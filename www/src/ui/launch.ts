/** 아이폰 홈 화면 웹앱: 스플래시와 똑같이 그려 둔 첫 화면(index.html #launch)을 앱이 다 그려진 뒤 흐리게 걷는다. 다른 곳에서는 이미 지워져 없다 */
export const LAUNCH_FADE_MS = 250
/** 글꼴을 이만큼까지만 기다린다(글자가 바뀌는 게 보이지 않게, 그래도 늦지 않게) */
export const LAUNCH_FONT_WAIT_MS = 500

export function hideLaunch(): void {
  const el = document.getElementById('launch')
  if (!el) return
  const go = (): void => { requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('out'); setTimeout(() => el.remove(), LAUNCH_FADE_MS + 50) })) }
  Promise.race([document.fonts?.ready, new Promise(r => setTimeout(r, LAUNCH_FONT_WAIT_MS))]).then(go, go)
}
