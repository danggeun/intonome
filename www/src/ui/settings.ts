/** 설정 페이지의 단계 버튼 ↔ settingsStore */
import { LANGS } from '../core/i18n/index.ts'
import { settingsStore, RMS_LEVELS, SMOOTH_LEVELS } from '../state/index.ts'
import { q, qsa, on, setOn } from './dom.ts'
import { canVibrate } from '../platform/index.ts'

function bindSteps(groupId: string, onPick: (v: number) => void): void {
  qsa<HTMLElement>(`#${groupId} .step-btn`).forEach(b => on(b, 'click', () => onPick(+b.dataset.v!)))
}
function markSteps(groupId: string, v: number): void { qsa<HTMLElement>(`#${groupId} .step-btn`).forEach(b => setOn(b, +b.dataset.v! === v)) }
/** 글자가 바뀌어 페이지 길이가 달라져도 그 칸이 화면에서 움직이지 않게 — 바꾸기 전 위치를 재고, 바꾼 뒤 그만큼 스크롤을 옮긴다.
 * 맨 아래에서 페이지가 짧아지면(일본어 → 한국어: 푸터 세 줄 → 한 줄, 설명 줄 수) 스크롤을 더 못 내려 카드가 내려오는데, 모자란 만큼 아래 여백(--settings-slack)을 잠시 두어 페이지 길이를 지킨다.
 * 여백은 설정을 닫을 때 지우고(menu.ts), 페이지가 다시 길어지면 바닥까지 남은 만큼만 줄인다 — 어느 쪽도 화면에 보이는 변화가 없다. 한 줄 푸터 언어에 상시 여백을 두는 방법(2.9.1 min-height)은 아래가 늘어져 보여 버렸다 */
function keepInPlace(id: string, change: () => void): void {
  const el = q(id), scroller = q('settings-page'), inner = q('settings-inner'), before = el.getBoundingClientRect().top
  change()
  const slack = parseFloat(inner.style.getPropertyValue('--settings-slack')) || 0
  if (slack) { const room = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop; setSlack(inner, slack - Math.min(slack, Math.max(0, room))) }
  scroller.scrollTop += el.getBoundingClientRect().top - before
  const rest = el.getBoundingClientRect().top - before
  if (rest > 0.5) { setSlack(inner, (parseFloat(inner.style.getPropertyValue('--settings-slack')) || 0) + rest); scroller.scrollTop += rest }
}
function setSlack(inner: HTMLElement, px: number): void { if (px > 0.5) inner.style.setProperty('--settings-slack', `${Math.ceil(px)}px`); else inner.style.removeProperty('--settings-slack') }
/** 설정을 닫을 때 — 다음에 열면 처음 길이로 */
export function clearSettingsSlack(): void { q('settings-inner').style.removeProperty('--settings-slack') }
const levelIndex = (levels: readonly number[], v: number) => levels.findIndex(x => Math.abs(x - v) < .001) + 1

export function mountSettings(): void {
  bindSteps('cents-steps', v => settingsStore.set({ tolCents: v }))
  bindSteps('rms-steps', v => { const r = RMS_LEVELS[v - 1]; if (r) settingsStore.set({ rmsMin: r }) })
  bindSteps('smooth-steps', v => { const s = SMOOTH_LEVELS[v - 1]; if (s) settingsStore.set({ smoothing: s }) })
  bindSteps('wakelock-steps', v => settingsStore.set({ wakeLock: v === 1 }))
  bindSteps('notenames-steps', v => settingsStore.set({ noteNames: v === 1 ? 'en' : 'ko' }))
  bindSteps('autodelete-steps', v => settingsStore.set({ autoDelete: v === 1 }))
  bindSteps('theme-steps', v => settingsStore.set({ theme: v === 1 ? 'light' : 'dark' }))
  bindSteps('lang-steps', v => keepInPlace('lang-steps', () => settingsStore.set({ lang: LANGS[v] ?? 'en' }))) // 언어 카드는 맨 아래 — 바꾸면 위 카드들의 글자 길이와 아래 푸터(한 줄 ↔ 세 줄)가 함께 바뀌어 손가락 아래 카드가 뛴다(ja → ko 약 80 px)
  bindSteps('haptics-steps', v => settingsStore.set({ haptics: v === 1 }))
  bindSteps('apitch-steps', v => { if (v === 2 || v === 3 || v === 4) settingsStore.set({ aOctave: v }) })

  settingsStore.select(s => s.tolCents, v => markSteps('cents-steps', v), { immediate: true })
  settingsStore.select(s => s.rmsMin, v => { const i = levelIndex(RMS_LEVELS, v); if (i) markSteps('rms-steps', i) }, { immediate: true })
  settingsStore.select(s => s.smoothing, v => { const i = levelIndex(SMOOTH_LEVELS, v); if (i) markSteps('smooth-steps', i) }, { immediate: true })
  settingsStore.select(s => s.wakeLock, v => markSteps('wakelock-steps', v ? 1 : 0), { immediate: true })
  settingsStore.select(s => s.noteNames, v => markSteps('notenames-steps', v === 'en' ? 1 : 0), { immediate: true })
  settingsStore.select(s => s.autoDelete, v => markSteps('autodelete-steps', v ? 1 : 0), { immediate: true })
  settingsStore.select(s => s.theme, v => markSteps('theme-steps', v === 'light' ? 1 : 0), { immediate: true })
  settingsStore.select(s => s.lang, v => markSteps('lang-steps', Math.max(0, LANGS.indexOf(v))), { immediate: true })
  settingsStore.select(s => s.aOctave, v => markSteps('apitch-steps', v), { immediate: true })
  settingsStore.select(s => s.haptics, v => markSteps('haptics-steps', v ? 1 : 0), { immediate: true })
  if (!canVibrate()) q('haptics-row').style.display = 'none' // 진동을 낼 수 없는 곳(오래된 아이폰 사파리 등)
  q('settings-version').textContent = `v${__APP_VERSION__}`
}
