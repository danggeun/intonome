/** 헤더의 REC 버튼과 녹음 타이머 표시 */
import { sessionStore, metroStore } from '../state/index.ts'
import { fmt } from '../core/format.ts'
import { toggleRec } from '../audio/recorder.ts'
import { micOpen } from '../audio/engine.ts'
import { q, on } from './dom.ts'
import { toast } from './toast.ts'
import { t as tr } from '../core/i18n/index.ts'

/** @param openMic 마이크가 꺼져 있으면 REC 가 먼저 켠다 (권한 거절이면 openMic 이 안내한다) */
export function mountRecHeader(openMic: () => Promise<boolean>): void {
  on(q('rec-hdr-btn'), 'click', async () => {
    if (!sessionStore.get().recording && !micOpen() && !(await openMic())) return
    const r = toggleRec(); if (!r.ok) toast(r.error)
  })
  sessionStore.select(s => s.recording, rec => {
    // 시작은 상태 전이에서. 메트로놈이 울리던 중이면 소리가 꺼진다는 것도 (클릭이 녹음에 섞이지 않게 — audio/metronome). '완료' 는 저장이 끝난 뒤 녹음 쪽이 알린다
    if (rec) toast(tr(metroStore.get().playing ? 'rec.startedMetroSilent' : 'rec.started'))
    q('rec-hdr-btn').classList.toggle('rec-on', rec); q('rec-hdr-btn').setAttribute('aria-pressed', String(rec)) // 화면 읽기에 녹음 중인지
    const t = q('hdr-rec-time'); t.classList.toggle('show', rec); t.textContent = fmt(0)
  })
  // 녹음 중에 메트로놈을 켜면 소리 없이 시작된다 — 고장으로 오해하지 않게
  metroStore.select(s => s.playing, on => { if (on && sessionStore.get().recording) toast(tr('metro.silentWhileRec')) })
  sessionStore.select(s => s.recElapsedSec, sec => { if (sessionStore.get().recording) q('hdr-rec-time').textContent = fmt(sec) })
}
