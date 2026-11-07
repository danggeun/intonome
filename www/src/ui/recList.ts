/** 메뉴의 녹음 목록 — 최신 1개 펼침 + 이전 N개 접힘, 항목별 미니 플레이어 */
import { recListStore, settingsStore, type RecItem } from '../state/index.ts'
import { fmtT, fmtMonthDay } from '../core/format.ts'
import { deleteRec, restoreDeleted, recFileName, patchRec } from '../audio/recorder.ts'
import { trustedDuration, expires, warnDaysLeft, DECODE_MAX_SEC } from '../core/recPolicy.ts'
import { setGlyph, glyphSvg } from './dom.ts'
import { saveFile, isIOS, isNative } from '../platform/index.ts'
import { bufToWav } from '../core/wav.ts'
import { recExt } from '../audio/recorder.ts'
import { attachGain, beforePlay, afterStop, releaseAudio } from '../audio/playback.ts'
import { toast } from './toast.ts'
import { t as tr, getLang } from '../core/i18n/index.ts'
import { onLangChange } from './lang.ts'
import { q, on } from './dom.ts'

/** 자동 이름(YYYYMMDD_HHMM)은 저장명으로 두고 표시는 읽히는 형태로: '9/5 10:50'. 뒤에 붙는 꼬리는 같은 분의 둘째 녹음·60 분 뒤 이어진 파일(`_2` → ' (2)')과
 * 복구(`_복구` → ' 복구')뿐 — 저장명 그대로 '20261026_1405_2' 로 보이지 않게. 사용자가 바꾼 이름은 그대로 */
export function displayName(item: RecItem): string {
  const m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})((?:_\d+)*)(?:_(\D\S*))?$/.exec(item.name)
  if (!m) return item.name
  const nums = m[6]!.split('_').filter(Boolean) // 같은 분의 둘째 테이크가 60 분을 넘기면 _2_2 → (2-2)
  return `${fmtMonthDay(+m[2]!, +m[3]!, getLang())} ${m[4]}:${m[5]}` + (nums.length ? ` (${nums.join('-')})` : '') + (m[7] ? ` ${m[7]}` : '')
}
const players: Record<number, HTMLAudioElement> = {}
/** 재생 전에 옮겨 둔 위치 — 재생이 시작돼 미디어 정보가 온 뒤에 넣는다. 정보도 없는 새 Audio 에 바로 넣으면
 *  안드로이드의 webm 녹음(길이·탐색 정보 없음)에서 재생이 아예 멈출 수 있다(2.9.3 회귀) */
const pendingSeek: Record<number, number> = {}
/** Web Audio(레벨 보정)를 거쳐 재생했더니 시간이 안 가던 녹음 — 다음부터는 바로 재생한다 */
const plainOnly = new Set<string>()
/** 손가락으로 잡고 있는 목록 슬라이더(번호), 없으면 -1 */
let holding = -1
function setPlayBtn(idx: number, playing: boolean): void { const b = document.getElementById('rec-pb-' + idx); if (b) { setGlyph(b, playing ? 'pause' : 'play'); b.setAttribute('aria-label', tr(playing ? 'ed.pause' : 'ed.play')); b.classList.toggle('playing', playing) } }
function getPlayer(idx: number): HTMLAudioElement {
  let a = players[idx]
  if (!a) {
    const item = recListStore.get().items[idx]!
    const el = new Audio(item.url)
    if (!plainOnly.has(item.url)) attachGain(el, item.peak) // 레벨 보정 · 첫 채널을 양쪽 귀로(audio/playback)
    el.ontimeupdate = () => {
      if (players[idx] !== el) return
      const sk = document.getElementById('rec-seek-' + idx) as HTMLInputElement | null, tm = document.getElementById('rec-time-' + idx)
      if (sk && holding !== idx) { sk.max = String(trustedDuration(item.dur, el.duration) || +sk.max || 1); sk.value = String(el.currentTime) } // 미디어가 말하는 길이는 녹음 길이로 거른다(core/recPolicy) — Chromium webm 은 Infinity 거나 안드로이드에선 수십 시간
      if (tm) tm.textContent = fmtT(el.currentTime)
    }
    el.onended = () => {
      if (players[idx] !== el) return
      afterStop(el)
      setPlayBtn(idx, false)
      const sk = document.getElementById('rec-seek-' + idx) as HTMLInputElement | null; if (sk) sk.value = '0'
      const tm = document.getElementById('rec-time-' + idx); if (tm) tm.textContent = fmtT(0)
      el.currentTime = 0
    }
    players[idx] = el; a = el
  }
  return a
}
function startPlay(idx: number, a: HTMLAudioElement): void {
  beforePlay(a); setPlayBtn(idx, true)
  const at = pendingSeek[idx]
  if (at !== undefined) {
    delete pendingSeek[idx]
    const apply = (): void => { try { a.currentTime = at } catch { /* 탐색할 수 없는 파일 — 처음부터 */ } }
    if (a.readyState >= 1) apply(); else a.addEventListener('loadedmetadata', apply, { once: true })
  }
  a.play().catch(() => { if (players[idx] !== a) return; afterStop(a); setPlayBtn(idx, false); toast(tr('common.cantPlay')) })
  // 1.5 초 지나도 시간이 안 가면(오디오 컨텍스트가 멈춰 있거나 기기가 Web Audio 경로로 이 파일을 못 돌림) 바로 재생으로 다시 —
  // 안드로이드에서 ▶ 를 눌러도 00:00 에 멈춰 있던 증상. 레벨 보정은 빠지지만 소리가 나는 쪽이 낫다
  watchStall(idx, a, at ?? a.currentTime, 0)
}
/** 재생을 눌렀는데 시간이 안 가는지 본다. 불러오는 중·옮기는 중이면 조금 더 기다리고(최대 6 초),
 *  레벨 보정 경로에서 멈췄으면 한 번만 바로 재생으로 바꾼다. 바로 재생도 안 가면 되풀이하지 않고 '재생할 수 없어요' */
function watchStall(idx: number, a: HTMLAudioElement, t0: number, tries: number): void {
  setTimeout(() => {
    if (players[idx] !== a || a.paused || Math.abs(a.currentTime - t0) > 0.05) return
    if ((a.seeking || a.readyState < 3) && tries < 3) { watchStall(idx, a, a.currentTime, tries + 1); return }
    const item = recListStore.get().items[idx]; if (!item) return
    if (plainOnly.has(item.url)) { a.pause(); afterStop(a); setPlayBtn(idx, false); toast(tr('common.cantPlay')); return }
    plainOnly.add(item.url)
    const at = a.currentTime
    releaseAudio(a); delete players[idx]
    if (at > 0) pendingSeek[idx] = at
    startPlay(idx, getPlayer(idx))
  }, 1500)
}
function playPause(idx: number): void {
  const a = getPlayer(idx)
  for (const k of Object.keys(players)) { const i = +k; if (i !== idx && !players[i]!.paused) { players[i]!.pause(); afterStop(players[i]!); setPlayBtn(i, false) } }
  if (a.paused) startPlay(idx, a); else { a.pause(); afterStop(a); setPlayBtn(idx, false) }
}
/** 위치 옮기기. 미디어 정보가 이미 있으면 바로, 아직 재생 전이면 기억했다가 재생을 시작하며 넣는다(슬라이더는 이미 그 자리를 가리킨다) */
function seek(idx: number): void {
  const sk = document.getElementById('rec-seek-' + idx) as HTMLInputElement | null, item = recListStore.get().items[idx]
  if (!sk || !item) return
  const a = players[idx], max = a && a.readyState >= 1 ? trustedDuration(item.dur, a.duration) || item.dur : item.dur
  const v = Math.min(+sk.value, max || +sk.value)
  if (a && a.readyState >= 1) { try { a.currentTime = v } catch { /* 탐색 불가 */ } }
  else if (a && !a.paused) a.addEventListener('loadedmetadata', () => { try { a.currentTime = v } catch { /* 탐색 불가 */ } }, { once: true }) // ▶ 직후 정보가 오기 전
  else pendingSeek[idx] = v
  const tm = document.getElementById('rec-time-' + idx); if (tm) tm.textContent = fmtT(v)
}
/** iOS: await 를 거친 뒤에는 탭의 활성화 창이 지나 공유 시트가 거부된다 → 토스트를 띄우고 그 탭 안에서 saveFile. 그 외는 바로 저장 */
export function handOff(blob: Blob, name: string): void {
  const go = (): void => { void saveFile(blob, name).then(r => { if (!r.ok) toast(tr('common.saveFailed', { e: r.error })) }) }
  if (isIOS()) toast(tr('rec.readyTap'), 8000, go); else go()
}
/** 다운로드 (편집기·목록 공용). webm 녹음은 WAV 로 변환해 건넨다 — 아이폰은 webm 을 못 열고, 받는 쪽이 아이폰이면 못 열며, Chromium 의 MediaRecorder webm 은 길이가 안 적혀 있어
 * 다른 플레이어에서 길이·탐색이 엉뚱하다(안드로이드 크롬 자신도 47 초를 75 시간으로 본다). 10 분이 넘으면(디코드 메모리) 아이폰은 안내만, 그 밖은 webm 그대로 */
let converting = false // 변환은 10 분에 Float32 ≈ 115 MB — 연타로 두 번 돌리지 않는다
export async function downloadRec(item: RecItem): Promise<void> {
  if (recExt(item) === 'webm' && (isIOS() || item.dur <= DECODE_MAX_SEC)) {
    if (item.dur > DECODE_MAX_SEC) { toast(tr('rec.tooLongConvert')); return }
    if (converting) return
    converting = true
    // 변환은 보통 1 초 안에 끝난다 — 그때는 안내 없이 바로 저장(웹앱은 브라우저 다운로드 알림과 겹쳐 두 개가 떴다). 오래 걸릴 때만 알린다
    const slow = setTimeout(() => toast(tr('rec.converting')), 1000)
    try {
      const arrayBuf = await (await fetch(item.url)).arrayBuffer()
      const decoded = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(arrayBuf)
      handOff(new Blob([bufToWav(decoded)], { type: 'audio/wav' }), 'intonome_' + item.name + '.wav')
    } catch (e) { toast(tr('rec.convertFailed', { e: e instanceof Error ? e.message : String(e) })) }
    finally { clearTimeout(slow); converting = false }
    return
  }
  const r = await saveFile(item.blob, recFileName(item)); if (!r.ok) toast(tr('common.saveFailed', { e: r.error }))
}
/** src 도 비운다 — WebView 는 동시 미디어 플레이어 수에 상한이 있어 붙잡고 있으면 재생이 조용히 실패한다 */
function stopPlayer(idx: number): void { const a = players[idx]; if (a) { releaseAudio(a); delete players[idx] } }
/** 편집기를 열 때 — 목록에서 듣던 소리가 편집기 소리와 겹치지 않게 멈춘다(위치는 둔다) */
export function stopListPlayers(): void { for (const k of Object.keys(players)) { const i = +k, a = players[i]!; if (!a.paused) { a.pause(); afterStop(a); setPlayBtn(i, false) } } }

/** 목록 메타 한 줄: 편집 흔적(북마크 n · A-B)과 삭제 예고. link 는 탭할 수 있는 꼬리('남기기' / '자동 삭제 안 함'), 없으면 null */
function itemMeta(item: RecItem, now = Date.now()): { text: string; link: string | null } {
  const parts: string[] = []
  if (item.bookmarks.length) parts.push(tr('rec.bookmarks', { n: item.bookmarks.length }))
  if (item.ab) parts.push('A-B')
  const autoDelete = settingsStore.get().autoDelete
  let link: string | null = null
  // 남긴 표시는 자동 삭제가 켜져 있을 때만 — 플래그는 남아 다시 켜면 되살아난다
  if (item.keep && autoDelete) link = tr('rec.noAutoDelete')
  else if (autoDelete) {
    // 자동 삭제까지 남은 날을 늘 보인다(판정은 persist 와 같은 함수) — 바로 옆 「남기기」 가 무엇을 남기는지 읽힌다
    const d = warnDaysLeft(item.ts, item.keep, autoDelete, now)
    if (d !== null) parts.push(d === 0 ? tr('rec.deletesToday') : tr('rec.deletesIn', { n: d }))
    link = tr('rec.keep')
  }
  return { text: parts.join(' · '), link }
}
/** 메타 줄 — 글자는 textContent 로, 탭 가능한 꼬리만 span */
function renderMeta(el: Element, item: RecItem, idx: number): void {
  const m = itemMeta(item)
  el.textContent = m.text
  if (m.link) {
    if (m.text) el.append(' · ')
    const a = document.createElement('span'); a.className = 'rec-keep-link'; a.dataset.action = 'keep'; a.dataset.idx = String(idx); a.textContent = m.link
    el.appendChild(a)
  }
}

/** 남기기 토글. 풀 때 이미 기한이 지났다면 다음 실행에서 사라지므로 미리 알린다 */
function toggleKeep(item: RecItem): void {
  const next = !item.keep
  const applied = patchRec(item, { keep: next })
  if (!applied) return
  if (next) { toast(tr('rec.keptToast')); return }
  if (expires(applied.ts, false, settingsStore.get().autoDelete, Date.now())) {
    toast(tr('rec.pastDue'), 5000, () => { patchRec(applied, { keep: true }) })
  } else toast(tr('rec.unkept'))
}

function renderItem(item: RecItem, idx: number, defaultOpen: boolean): HTMLElement {
  const div = document.createElement('div'); div.className = 'rec-item'; div.dataset.idx = String(idx)
  div.innerHTML = `
      <div class="rec-item-head" data-action="toggle" data-idx="${idx}">
        <div><span class="rec-item-name"></span><div class="rec-item-meta"></div></div>
        <span class="rec-item-dur">${fmtT(item.dur)}</span>
      </div>
      <div class="rec-item-detail${defaultOpen ? ' open' : ''}" id="rec-detail-${idx}">
        <div class="rec-player">
          <div class="rec-player-top">
            <button class="rec-play-btn" id="rec-pb-${idx}" data-action="play" data-idx="${idx}" data-glyph="play" aria-label="${tr('ed.play')}">${glyphSvg('play')}</button>
            <input type="range" class="rec-seek" id="rec-seek-${idx}" aria-label="${tr('rec.position')}" value="0" min="0" max="${item.dur || 100}" step="0.01" data-action="seek" data-idx="${idx}">
            <span class="rec-time" id="rec-time-${idx}">00:00</span>
          </div>
          <div class="rec-item-btns">
            <button class="rec-item-btn" data-action="edit" data-idx="${idx}">${tr('rec.edit')}</button>
            <a class="rec-item-btn rec-dl-link" href="${item.url}" data-action="download" data-idx="${idx}">${tr(isNative() ? 'common.share' : 'common.download')}</a>
            <button class="rec-item-btn del" data-action="delete" data-idx="${idx}">${tr('rec.delete')}</button>
          </div>
        </div>
      </div>`
  div.querySelector('.rec-item-name')!.textContent = displayName(item) // 사용자 데이터는 textContent 로만 (인젝션 방지)
  renderMeta(div.querySelector('.rec-item-meta')!, item, idx)
  ;(div.querySelector('.rec-dl-link') as HTMLAnchorElement).download = recFileName(item)
  return div
}

function render(): void {
  for (const k of Object.keys(players)) { releaseAudio(players[+k]!); delete players[+k] }
  for (const k of Object.keys(pendingSeek)) delete pendingSeek[+k] // 목록을 다시 그리면 번호가 바뀐다
  const list = q('rec-list'); list.innerHTML = ''
  const items = recListStore.get().items
  if (items.length === 0) { const e = document.createElement('div'); e.id = 'rec-empty'; e.textContent = tr('rec.empty'); list.appendChild(e); return }
  list.appendChild(renderItem(items[0]!, 0, true))
  if (items.length > 1) {
    const oldWrap = document.createElement('div')
    const toggleBtn = document.createElement('button'); toggleBtn.className = 'rec-more'
    toggleBtn.textContent = tr('rec.showOlder', { n: items.length - 1 })
    let oldOpen = false
    const oldList = document.createElement('div'); oldList.className = 'rec-old'
    items.slice(1).forEach((it, i) => oldList.appendChild(renderItem(it, i + 1, false)))
    toggleBtn.onclick = () => {
      oldOpen = !oldOpen
      oldList.classList.toggle('open', oldOpen)
      toggleBtn.textContent = oldOpen ? tr('rec.hideOlder') : tr('rec.showOlder', { n: items.length - 1 })
    }
    oldWrap.appendChild(toggleBtn); oldWrap.appendChild(oldList); list.appendChild(oldWrap)
  }
}

export function mountRecList(openEditor: (item: RecItem) => void, beforeDelete: (item: RecItem) => void): void {
  const list = q('rec-list')
  on(list, 'click', (e: MouseEvent) => {
    let t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
    // 카드의 여백(머리글 밖, 상세 밖)을 눌러도 펼친다 — 머리글 17 px 줄만 받으면 손가락이 자주 빗나간다
    if (!t) { const card = (e.target as HTMLElement).closest<HTMLElement>('.rec-item[data-idx]'); if (!card || (e.target as HTMLElement).closest('.rec-item-detail')) return; t = card.querySelector<HTMLElement>('.rec-item-head[data-action="toggle"]'); if (!t) return }
    const idx = +t.dataset.idx!, item = recListStore.get().items[idx]
    switch (t.dataset.action) {
      case 'toggle': document.getElementById('rec-detail-' + idx)?.classList.toggle('open'); break
      case 'play': playPause(idx); break
      case 'edit': if (item) openEditor(item); break
      case 'keep': if (item) toggleKeep(item); break
      case 'delete': { // 확인 대신 실행 취소 토스트
        if (!item) break
        beforeDelete(item); stopPlayer(idx)
        void deleteRec(item).then(r => {
          if (r === 'ok') toast(tr('rec.deleted') + tr('common.undoSuffix'), 5000, () => { void restoreDeleted(item, idx) })
          else if (r === 'failed') toast(tr('rec.deleteFailed'))
        })
        break
      }
      case 'download': { e.preventDefault(); if (item) void downloadRec(item); break }
    }
  })
  on(list, 'input', (e: Event) => { const t = e.target as HTMLElement; if (t.dataset.action === 'seek') seek(+t.dataset.idx!) })
  // 슬라이더를 잡고 있는 동안은 재생 위치가 손가락 아래 동그라미를 옮기지 않는다
  on(list, 'pointerdown', (e: Event) => { const t = e.target as HTMLElement; if (t.dataset.action === 'seek') holding = +t.dataset.idx! })
  for (const ev of ['pointerup', 'pointercancel']) on(window, ev, () => { holding = -1 })
  recListStore.select(s => s.rev, render, { immediate: true }) // 녹음이 하나도 없으면 저장소 복원이 rev 를 올리지 않는다 — 빈 목록 안내는 여기서
  onLangChange(render)
  settingsStore.select(s => s.autoDelete, () => { const st = recListStore.get(); recListStore.set({ rev: st.rev + 1 }) }) // 보관 설정이 바뀌면 예고문 갱신
  // patchRec(items 배열만 교체)에는 메타 줄만 제자리 갱신 — 전체 재렌더는 펼침 상태와 미니 플레이어를 리셋한다
  recListStore.select(s => s.items, items => {
    list.querySelectorAll<HTMLElement>('.rec-item[data-idx]').forEach(el => {
      const it = items[+el.dataset.idx!]; if (!it) return
      const m = el.querySelector('.rec-item-meta'); if (m) renderMeta(m, it, +el.dataset.idx!)
    })
  })
}
