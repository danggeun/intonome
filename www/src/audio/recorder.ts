/** 녹음 (MediaRecorder) + 녹음 목록 상태 */
import { recListStore, sessionStore, type RecItem } from '../state/index.ts'
import { dbSave, dbDelete, dbPatchMeta, dbLoadAll, dbLastExpired, dbChunkAdd, dbChunksClear, dbChunksLoad, type ChunkRow } from '../persist/recordingsDb.ts'
import { computePeaks, peakOf } from '../core/peaks.ts'
import { containerOf, extFromMime, type RecContainer } from '../core/container.ts'
import { t } from '../core/i18n/index.ts'
import { notice } from '../core/notice.ts'
import { isIOS, isSafari } from '../platform/index.ts'
import { A, onMic } from './engine.ts'

/** 파일 하나의 상한. 이보다 길면 같은 세션이 새 파일로 이어진다 — 조각은 10 s 마다 IndexedDB 에 있지만 blob 을 만들 parts 는 메모리에 쌓인다(256 kbps × 60 min ≈ 115 MB) */
const MAX_REC_SEC = 60 * 60
let recorder: MediaRecorder | null = null
let timerInt: ReturnType<typeof setInterval> | null = null

/** 확장자: 저장 때 파일 내용으로 판정해 둔 값이 우선, 없으면(옛 행) mime 으로 추정 */
export const recExt = (item: Pick<RecItem, 'ext' | 'mime'>): RecContainer => item.ext ?? extFromMime(item.mime)
export function recFileName(item: RecItem): string { return 'intonome_' + item.name + '.' + recExt(item) }
const stamp = (ms: number): string => { const n = new Date(ms); return `${n.getFullYear()}${String(n.getMonth() + 1).padStart(2, '0')}${String(n.getDate()).padStart(2, '0')}_${String(n.getHours()).padStart(2, '0')}${String(n.getMinutes()).padStart(2, '0')}` }
/** 목록에 같은 이름이 있으면 _2, _3 … — 같은 분(分)에 짧은 테이크를 여러 번 하면 이름·파일명이 전부 같았다 */
export function uniqueName(base: string, taken: ReadonlyArray<string> = recListStore.get().items.map(i => i.name)): string {
  if (!taken.includes(base)) return base
  for (let k = 2; ; k++) { const n = `${base}_${k}`; if (!taken.includes(n)) return n }
}

export type RecResult = { ok: true } | { ok: false; error: string }
/** 조각 간격. 앱이 죽어도 이만큼만 잃는다 */
export const REC_SLICE_MS = 10_000
export function startRec(): RecResult {
  if (!A.micStream) return { ok: false, error: t('rec.needMic') }
  if (recorder && recorder.state !== 'inactive') return { ok: false, error: t('rec.already') }
  const t0 = Date.now()
  const r = startFile(t0, uniqueName(stamp(t0))) // 세션 이름은 여기서 한 번 — 60 분 뒤 이어지는 파일은 이 이름 + _2, _3 …
  if (!r.ok) return r
  sessionStore.set({ recording: true, recElapsedSec: 0 })
  if (timerInt) clearInterval(timerInt)
  timerInt = setInterval(() => {
    const sec = Math.round((Date.now() - t0) / 1000); sessionStore.set({ recElapsedSec: sec }) // 벽시계 기준 — 백그라운드 스로틀링에도 정확
    if (recorder && recorder.state !== 'inactive' && Date.now() - fileT0 >= MAX_REC_SEC * 1000) rollover() // 60 분마다 파일을 끊어 잇는다 — 레슨이 멈추지 않게
  }, 1000)
  return { ok: true }
}
let fileT0 = 0, fileBase = '', filePart = 1
/** 파일 하나를 시작한다. 세션(sessionStore.recording·헤더 시간)은 건드리지 않는다 */
function startFile(t0: number, base: string, part = 1): RecResult {
  if (typeof MediaRecorder === 'undefined') return { ok: false, error: t('rec.unsupported') }
  // iOS 18.4+ Safari 는 webm 녹음이 되지만 iOS 가 .webm 을 못 연다 → iOS 만 mp4(AAC) 우선
  // Chromium 은 'audio/mp4' 를 Opus-in-MP4 로 출력하므로 다른 플랫폼은 webm 우선
  const mimes = isIOS() || isSafari()
    ? ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', '']
    : ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', '']
  const mime = mimes.find(m => !m || MediaRecorder.isTypeSupported(m)) || ''
  const opts: MediaRecorderOptions = { audioBitsPerSecond: 256000 }; if (mime) opts.mimeType = mime
  // 세션 상태는 클로저에 가둔다 — 정지 직후 재시작하면 이전 세션의 늦은 ondataavailable/onstop 이 섞인다
  let rec: MediaRecorder
  try { rec = new MediaRecorder(A.micStream!, opts) } catch (e) { return { ok: false, error: t('rec.unsupported') + (e instanceof Error ? ` (${e.name})` : '') } }
  const parts: Blob[] = []
  let liveFrom = 0 // 조각마다 그 사이의 실시간 피크를 같이 저장한다 — 복구 때 파형과 재생 보정 피크가 된다
  rec.ondataavailable = e => { if (e.data.size > 0) { parts.push(e.data); const live = myPeaks.slice(liveFrom); liveFrom = myPeaks.length; void dbChunkAdd({ session: t0, t: Date.now(), mime: rec.mimeType, blob: e.data, live }) } }
  rec.onerror = () => { notice(t('rec.errSaved')); if (recorder === rec) stopRec() }
  // 파형·피크·확장자는 부가 정보 — 실패해도 녹음은 저장한다. blob 을 못 만들 때만 포기
  rec.onstop = async () => {
    let blob: Blob
    try { blob = new Blob(parts, { type: rec.mimeType || 'audio/mp4' }) }
    catch { parts.length = 0; notice(t('rec.saveFailed')); return }
    parts.length = 0 // 60분 녹음 ≈ 115 MB 가 두 벌 남지 않게
    const name = part > 1 ? `${base}_${part}` : uniqueName(base)
    // 파형용 peaks 는 정규화돼 절대 레벨이 사라진다 → 재생 보정용 원시 피크를 따로 남긴다
    let peak: number | undefined, peaks: Float32Array | undefined
    try {
      peak = myPeaks.length ? peakOf(myPeaks) : undefined
      peaks = myPeaks.length ? computePeaks([Float32Array.from(myPeaks)], 600) : undefined
    } catch { peak = undefined; peaks = undefined; notice(t('rec.noWaveform')) }
    // 확장자는 mimeType 이 아니라 파일 앞부분 바이트로 정한다 — 빈 mimeType·예상 밖 값 대비
    let ext: RecContainer
    try { ext = containerOf(new Uint8Array(await blob.slice(0, 16).arrayBuffer().catch(() => new ArrayBuffer(0))), rec.mimeType) }
    catch { ext = extFromMime(rec.mimeType) }
    const item: RecItem = { id: null, url: URL.createObjectURL(blob), name, dur: Math.round((Date.now() - t0) / 1000), blob, mime: rec.mimeType, ext, peak, ts: t0, bookmarks: [], ab: null, peaks }
    // 목록에는 먼저 넣고 id 는 저장이 끝난 뒤 붙인다 — 큰 파일은 저장에 1~3 s 걸려 "녹음 완료" 뒤 메뉴를 열면 항목이 없었다
    const st = recListStore.get(); recListStore.set({ items: [item, ...st.items], rev: st.rev + 1 })
    const id = await dbSave({ name: item.name, dur: item.dur, blob: item.blob, mime: item.mime, ts: item.ts }, { bookmarks: [], ab: null, peaks, ext, peak }).catch(() => null)
    if (id == null) notice(t('rec.sessionOnly'), 10000) // 용량 부족·프라이빗 모드 등 — 앱을 닫으면 사라진다. 다운로드할 시간을 준다
    else void dbChunksClear(t0)
    attachId(item, id)
  }
  try { rec.start(REC_SLICE_MS) } catch (e) { return { ok: false, error: t('rec.startFailed') + (e instanceof Error ? ` (${e.name})` : '') } } // 트랙이 막 죽은 순간 InvalidStateError
  recorder = rec; fileT0 = t0; fileBase = base; filePart = part
  const myPeaks = startPeakCapture() // 이 파일의 피크 배열 — 다음 파일이 새 배열을 만들어도 참조 유지
  return { ok: true }
}
/** 테스트용: 지금 파일의 시작 시각을 과거로 — 다음 초에 60 분 상한이 걸린다 */
export function backdateRecFile(ms: number): void { fileT0 -= ms }
/** 60 분 상한: 지금 파일을 저장하고 같은 세션을 새 파일(_2, _3 …)로 잇는다. 헤더의 시간은 계속 흐른다 */
function rollover(): void {
  if (!recorder || recorder.state === 'inactive') return
  recorder.stop(); stopPeakCapture()
  const r = startFile(Date.now(), fileBase, filePart + 1)
  if (r.ok) notice(t('rec.rolledOver'), 6000)
  else { notice(r.error); stopRec() }
}
export function stopRec(): void {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  stopPeakCapture() // stop 전에 피크 캡처를 멈춘다 — onstop 은 늦게 온다
  if (timerInt) clearInterval(timerInt); timerInt = null
  sessionStore.set({ recording: false, recElapsedSec: 0 })
}
export function toggleRec(): RecResult { return sessionStore.get().recording ? (stopRec(), { ok: true }) : startRec() }

// 녹음 중 파형 피크 누적 — 디코드 없이 파형을 얻어 긴 녹음의 디코드 메모리를 피한다
let livePeaks: number[] = [], peakTimer: ReturnType<typeof setInterval> | null = null, peakAnalyser: AnalyserNode | null = null
const peakBuf = new Float32Array(2048)
function startPeakCapture(): number[] {
  stopPeakCapture(); livePeaks = []
  if (!A.micSource || !A.ac) return livePeaks
  peakAnalyser = A.ac.createAnalyser(); peakAnalyser.fftSize = 2048; A.micSource.connect(peakAnalyser)
  peakTimer = setInterval(() => { peakAnalyser!.getFloatTimeDomainData(peakBuf); let m = 0; for (let i = 0; i < peakBuf.length; i++) { const v = Math.abs(peakBuf[i]!); if (v > m) m = v } livePeaks.push(m) }, 50) // 20 개/초
  return livePeaks
}
function stopPeakCapture(): void { if (peakTimer) clearInterval(peakTimer); peakTimer = null; peakAnalyser?.disconnect(); peakAnalyser = null }

/** 항목 식별은 인덱스가 아니라 항목 자체 — 녹음 중 prepend 로 인덱스가 밀린다 */
export const indexOf = (item: RecItem): number => recListStore.get().items.indexOf(item)
/** DB 삭제가 성공한 뒤에만 목록에서 뺀다 — 먼저 빼면 실패 시 다음 실행에서 되살아난다. id 없는 항목은 목록에서만 */
const deleting = new WeakSet<RecItem>() // DB 응답 대기 중 같은 항목의 연타를 막는다 — 실행 취소 토스트가 둘 뜬다
export async function deleteRec(item: RecItem): Promise<boolean> {
  if (deleting.has(item) || !recListStore.get().items.includes(item)) return false
  deleting.add(item)
  try {
    if (item.id != null && !(await dbDelete(item.id))) return false
    URL.revokeObjectURL(item.url)
    const st = recListStore.get(); recListStore.set({ items: st.items.filter(i => i !== item), rev: st.rev + 1 })
    return true
  } finally { deleting.delete(item) }
}
/** 삭제 취소용: 항목을 원래 자리에 되돌리고 DB 에 다시 저장 */
export async function restoreDeleted(item: RecItem, at: number): Promise<void> {
  const st = recListStore.get(); const items = st.items.slice()
  const back: RecItem = { ...item, id: null, url: URL.createObjectURL(item.blob) } // 옛 id 를 들고 있지 않는다 — 저장 전에 편집이 끼면 죽은 키에 쓴다
  items.splice(Math.min(at, items.length), 0, back)
  recListStore.set({ items, rev: st.rev + 1 })
  const id = await dbSave({ name: back.name, dur: back.dur, blob: back.blob, mime: back.mime, ts: back.ts }, { bookmarks: back.bookmarks, ab: back.ab, peaks: back.peaks, ext: back.ext, peak: back.peak, keep: back.keep }).catch(() => null)
  // 그 사이 patchRec 이 객체를 바꿨을 수 있다 → blob 동일성으로 찾는다. 저장되는 동안 다시 지웠으면(id 가 없어 목록에서만 빠졌다) DB 에서도 지운다 — 안 그러면 다음 실행에 유령 행
  attachId(back, id)
}
/** 저장이 끝난 항목에 id 를 붙인다. 그 사이 patchRec 이 객체를 바꿨을 수 있다 → blob 동일성으로 찾고, 바뀐 메타(남기기·이름·북마크)는 DB 에 다시 쓴다.
 * 저장되는 동안 지웠으면(id 가 없어 목록에서만 빠졌다) DB 에서도 지운다 — 안 그러면 다음 실행에 유령 행 */
function attachId(saved: RecItem, id: number | null): void {
  const st = recListStore.get(); const i = st.items.findIndex(x => x.blob === saved.blob)
  if (i < 0) { void dbDelete(id); return }
  const cur = st.items[i]!; const items = st.items.slice(); items[i] = { ...cur, id }; recListStore.set({ items, rev: st.rev })
  if (id != null && cur !== saved) void dbPatchMeta(id, { name: cur.name, bookmarks: cur.bookmarks, ab: cur.ab, keep: cur.keep, speed: cur.speed })
}
/** 편집 상태(북마크/A-B/파형/속도)·이름을 메모리와 IndexedDB(meta) 에 반영. 새 항목 객체를 반환 */
export function patchRec(item: RecItem, patch: Partial<Pick<RecItem, 'name' | 'bookmarks' | 'ab' | 'peaks' | 'speed' | 'keep'>>): RecItem | null {
  const st = recListStore.get(); const idx = st.items.indexOf(item); if (idx < 0) return null
  const items = st.items.slice(); const next = { ...item, ...patch }; items[idx] = next
  void dbPatchMeta(item.id, patch)
  // rev(전체 재렌더 — 펼침·미니 플레이어 리셋)는 이름 변경 때만. 북마크/A-B 는 items 교체로 제자리 갱신
  recListStore.set({ items, rev: 'name' in patch ? st.rev + 1 : st.rev })
  return next
}
/** 앱 시작 시 IndexedDB 에서 복원. 30 일이 지나 지운 개수를 돌려준다 */
export async function restoreRecordings(): Promise<number> {
  const rows = await dbLoadAll().catch(() => [])
  if (rows.length) {
    const items: RecItem[] = rows.map(r => ({ id: r.id ?? null, url: URL.createObjectURL(r.blob), name: r.name, dur: r.dur, blob: r.blob, mime: r.mime, ext: r.ext, peak: r.peak, ts: r.ts, bookmarks: r.bookmarks, ab: r.ab, peaks: r.peaks, speed: r.speed, keep: r.keep }))
    const st = recListStore.get(); recListStore.set({ items: [...st.items, ...items], rev: st.rev + 1 })
  }
  return dbLastExpired()
}
/** 지난 실행에서 끝내지 못한 녹음(조각)을 항목으로 되살린다. 되살린 개수를 돌려준다 */
export async function recoverInProgress(): Promise<number> {
  const groups = await dbChunksLoad().catch(() => new Map<number, ChunkRow[]>())
  let n = 0
  for (const [session, chunks] of groups) {
    if (sessionStore.get().recording && chunks[0]?.session === session) continue
    // 저장이 끝난 직후 앱이 죽어 조각만 남은 경우(dbChunksClear 전) — 같은 녹음이 이미 목록에 있으면 조각만 치운다
    if (recListStore.get().items.some(i => i.ts === session)) { await dbChunksClear(session); continue }
    const mime = chunks[0]!.mime, blob = new Blob(chunks.map(c => c.blob), { type: mime || 'audio/mp4' })
    const last = chunks[chunks.length - 1]!.t, dur = Math.max(1, Math.round((last - session) / 1000))
    const name = uniqueName(`${stamp(session)}${t('rec.recoveredSuffix')}`)
    let ext: RecContainer
    try { ext = containerOf(new Uint8Array(await blob.slice(0, 16).arrayBuffer()), mime) } catch { ext = extFromMime(mime) }
    // 조각에 같이 저장한 실시간 피크로 파형과 재생 보정 피크를 되살린다 — 없으면(옛 조각) 재생 보정은 기본 부스트(LEGACY_GAIN)로 가고 왜곡될 수 있었다
    const live = chunks.flatMap(c => c.live ?? [])
    let peak: number | undefined, peaks: Float32Array | undefined
    try { if (live.length) { peak = peakOf(live); peaks = computePeaks([Float32Array.from(live)], 600) } } catch { peak = undefined; peaks = undefined }
    const item: RecItem = { id: null, url: URL.createObjectURL(blob), name, dur, blob, mime, ext, peak, ts: session, bookmarks: [], ab: null, peaks }
    item.id = await dbSave({ name, dur, blob, mime, ts: session }, { bookmarks: [], ab: null, ext, peak, peaks }).catch(() => null)
    if (item.id == null) continue
    await dbChunksClear(session)
    const st = recListStore.get(); recListStore.set({ items: [item, ...st.items], rev: st.rev + 1 })
    n++
  }
  return n
}

onMic('beforeClose', () => { if (sessionStore.get().recording) stopRec() })
