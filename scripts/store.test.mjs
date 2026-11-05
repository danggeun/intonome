import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRIVACY_URL, CONTACT_EMAIL } from '../www/src/core/links.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const md = readFileSync(join(ROOT, 'docs', 'STORE.md'), 'utf8')
/** `## 제목` 절 아래의 코드 블록들 */
const blocks = title => { const sec = md.split(/^## /m).find(s => s.startsWith(title)); return sec ? [...sec.matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1]) : [] }
const len = s => [...s].length // 코드 포인트 수 — Play 는 글자 수로 센다

describe('STORE.md matches what Play Console accepts and what the app says', () => {
  const FULLS = ['Korean', 'English', 'Japanese', 'Chinese']
  test('app name ≤ 30, short description ≤ 80, full description ≤ 4000 (Korean, English, Japanese, Chinese)', () => {
    const names = blocks('App name'), shorts = blocks('Short description'), fulls = FULLS.flatMap(l => blocks(`Full description (${l})`))
    expect(names.length).toBe(4); expect(shorts.length).toBe(4); expect(fulls.length).toBe(4)
    for (const n of names) expect(len(n)).toBeLessThanOrEqual(30)
    for (const s of shorts) expect(len(s)).toBeLessThanOrEqual(80)
    for (const f of fulls) expect(len(f)).toBeLessThanOrEqual(4000)
  })
  test('the privacy policy URL and the contact email are the ones the app links to (core/links.ts)', () => {
    expect(md).toContain(PRIVACY_URL); expect(md).toContain(CONTACT_EMAIL)
  })
  test('no other app names in the listing text (store policy)', () => {
    for (const f of FULLS.flatMap(l => blocks(`Full description (${l})`))) expect(f).not.toMatch(/TonalEnergy|Soundcorset|Tunable|Cleartune|Tuner T1|Pro Metronome/i)
  })
})
