/**
 * 메트로놈 카드의 단계 — 접힘(c) · 펼침(e) · 펼침2(f, 메트로놈만 크게). 저장값(collapsed·full)과 화면 폭에서 보이는 단계를 정하고,
 * 크기 버튼·끌기가 어디로 가는지, 놓았을 때 넘어가는지를 정한다. 순수
 */
export type Stage = 'c' | 'e' | 'f'

/** 보이는 단계 — 넓은 화면에는 접힘이 없다(collapsed 가 켜져 있어도 펼쳐져 보인다) */
export function stageOf(collapsed: boolean, full: boolean, phone: boolean): Stage { return full ? 'f' : collapsed && phone ? 'c' : 'e' }
/** 단계로 가는 저장값 변경. 접힘은 collapsed 만 켠다(펼침2 에서 바로 접힘으로 가는 길은 없다) */
export function stageChange(st: Stage): { full?: boolean; collapsed?: boolean } { return st === 'f' ? { full: true } : st === 'e' ? { full: false, collapsed: false } : { collapsed: true } }
/** 크기 버튼의 목적지: 펼침2 → 펼침, 폰은 접힘 ⇄ 펼침, 넓은 화면은 펼침 → 펼침2 */
export function sizeBtnTarget(st: Stage, phone: boolean): Stage { return st === 'f' ? 'e' : !phone ? 'f' : st === 'c' ? 'e' : 'c' }

// 위로 끌면 접힘 → 펼침 → 펼침2, 아래로 끌면 반대
const UP: Record<Stage, Stage | null> = { c: 'e', e: 'f', f: null }
const DOWN: Record<Stage, Stage | null> = { f: 'e', e: 'c', c: null }
/** 끌기의 목적지 (dir −1 = 위). 갈 곳이 없거나 넓은 화면에서 접힘으로 가는 끌기는 null */
export function dragTarget(from: Stage, dir: -1 | 1, phone: boolean): Stage | null {
  const to = dir < 0 ? UP[from] : DOWN[from]
  return !to || (to === 'c' && !phone) ? null : to
}
/** 손을 따라오는 끌기: 카드 높이(h0 → h1 사이로 묶음)와 진행률 p (0 = 출발, 1 = 도착). 카드는 아래에 붙어 있어 손이 위로 가면(dy < 0) 커진다 */
export function dragProgress(h0: number, h1: number, dy: number): { h: number; p: number } {
  const h = Math.min(Math.max(h0, h1), Math.max(Math.min(h0, h1), h0 - dy))
  return { h, p: (h - h0) / ((h1 - h0) || 1) }
}
const COMMIT_P = 0.3, COMMIT_VEL = 0.35, STEP_PX = 40
/** 놓았을 때 넘어가나 — 멀리(30 %) 끌었거나, 그 방향으로 튕겼거나(0.35 px/ms, 조금이라도 움직였을 때) */
export function dragCommits(p: number, vy: number, dir: -1 | 1): boolean { return p >= COMMIT_P || (vy * dir > COMMIT_VEL && p > 0.03) }
/** 손을 따라오지 않는 끌기(넓은 화면·동작 줄이기): 그 방향으로 40 px 밀면 한 단계 */
export function stepCommits(dy: number, dir: -1 | 1): boolean { return dy * dir >= STEP_PX }
