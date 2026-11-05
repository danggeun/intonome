/** 화면 언어. 문구는 ko.ts(원본)·en.ts·ja.ts·zh.ts(간체), 고르는 건 설정 lang */
import { KO, type TKey } from './ko.ts'
import { EN } from './en.ts'
import { JA } from './ja.ts'
import { ZH } from './zh.ts'

export type Lang = 'ko' | 'en' | 'ja' | 'zh'
export const LANGS: readonly Lang[] = ['ko', 'en', 'ja', 'zh'] // 설정 「언어」 버튼의 순서(data-v = 색인)
export const isLang = (v: unknown): v is Lang => (LANGS as readonly unknown[]).includes(v)
/** 음이름이 C D E 하나뿐인 언어 — 설정의 「음이름 표기」 줄을 숨긴다. 한국어·일본어는 계이름(도레미·ドレミ)과 C D E 중 고른다 */
export const lettersOnly = (l: Lang): boolean => l === 'en' || l === 'zh'
export type { TKey }

const DICT: Record<Lang, Record<TKey, string>> = { ko: KO, en: EN, ja: JA, zh: ZH }
let cur: Lang = 'ko'

export function setLang(l: Lang): void { cur = l }
export function getLang(): Lang { return cur }

/** 키 → 지금 언어의 문구. {name} 은 p 로 채우고, {n|하나|여럿} 은 n 이 1 인지로 고른다 */
export function t(key: TKey, p?: Record<string, string | number>): string {
  let s: string = DICT[cur][key]
  if (!p) return s
  s = s.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_, k: string, one: string, other: string) => (Number(p[k]) === 1 ? one : other))
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? String(p[k]) : m))
}
