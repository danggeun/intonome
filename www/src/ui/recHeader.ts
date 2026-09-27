/** 헤더의 REC 버튼과 녹음 타이머 표시 */
import { sessionStore } from '../state/index.ts'
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
    toast(tr(rec ? 'rec.started' : 'rec.done')) // 버튼이 아니라 상태 전이에서: 마이크 자동 종료로 멈춘 경우에도 안내
    q('rec-hdr-btn').classList.toggle('rec-on', rec)
    const t = q('hdr-rec-time'); t.classList.toggle('show', rec); t.textContent = fmt(0)
  })
  sessionStore.select(s => s.recElapsedSec, sec => { if (sessionStore.get().recording) q('hdr-rec-time').textContent = fmt(sec) })
}
