import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringLiterals } from './lib/strings.mjs'
import { KO } from '../www/src/core/i18n/ko.ts'
import { EN } from '../www/src/core/i18n/en.ts'
import { JA } from '../www/src/core/i18n/ja.ts'
import { ZH } from '../www/src/core/i18n/zh.ts'
import { ZH_HANT } from '../www/src/core/i18n/zhHant.ts'
import { ES } from '../www/src/core/i18n/es.ts'
import { t, setLang } from '../www/src/core/i18n/index.ts'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'www', 'src')
const HANGUL = /[가-힣]/
const KANA = /[\u3040-\u30ff]/ // 히라가나·가타카나 — 일본어에만
const OTHERS = { en: EN, ja: JA, 'zh-Hans': ZH, 'zh-Hant': ZH_HANT, es: ES }
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(p) && !/\.test\.ts$/.test(p) ? [p] : [] })
// 한국어가 코드에 있어도 되는 곳: 문구 원본, 음이름 데이터, 기준음 버튼의 내부 키('도2')와 한국어 표기
const ALLOWED_FILES = ['core/i18n/ko.ts', 'core/note.ts']
const ALLOWED_TEXT = new Set(['도2', '도↑'])

describe('i18n dictionaries', () => {
  test.each(Object.keys(OTHERS))('%s has every key and nothing else', l => expect(Object.keys(OTHERS[l]).sort()).toEqual(Object.keys(KO).sort()))
  test.each(Object.keys(OTHERS))('no Korean left in %s strings', l => {
    const bad = Object.entries(OTHERS[l]).filter(([, v]) => HANGUL.test(v)).map(([k]) => k)
    expect(bad).toEqual([])
  })
  test('no kana in English or Chinese, no Japanese kana-free Chinese-only text in Japanese', () => {
    expect(Object.entries(EN).filter(([, v]) => KANA.test(v)).map(([k]) => k)).toEqual([])
    expect(Object.entries(ZH).filter(([, v]) => KANA.test(v)).map(([k]) => k)).toEqual([])
    expect(Object.entries(ZH_HANT).filter(([, v]) => KANA.test(v)).map(([k]) => k)).toEqual([])
    expect(Object.entries(ES).filter(([, v]) => KANA.test(v) || /[\u4e00-\u9fff]/.test(v)).map(([k]) => k)).toEqual([])
  })
  test.each(Object.keys(OTHERS))('placeholders match between Korean and %s', l => {
    const names = s => [...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map(m => m[1]).sort().filter((v, i, a) => a.indexOf(v) === i)
    const bad = Object.keys(KO).filter(k => names(KO[k]).join() !== names(OTHERS[l][k]).join())
    expect(bad).toEqual([])
  })
  test.each(Object.keys(OTHERS))('<br> only where Korean has it too (%s)', l => {
    const bad = Object.keys(KO).filter(k => KO[k].includes('<br>') !== OTHERS[l][k].includes('<br>'))
    expect(bad).toEqual([])
  })
  test('every language ends sentences without a full stop, like Korean (toasts and labels)', () => {
    const bad = []
    for (const [l, d] of Object.entries({ ko: KO, ...OTHERS })) for (const [k, v] of Object.entries(d)) if (/[.。]$/.test(v) && !/\.\.\.$/.test(v)) bad.push(`${l}:${k}`) // '연결 중...' 의 줄임표는 허용
    expect(bad).toEqual([])
  })
  test('t() fills values and picks singular/plural', () => {
    setLang('en')
    expect(t('rec.deletesIn', { n: 1 })).toBe('Deletes in 1 day')
    expect(t('rec.deletesIn', { n: 3 })).toBe('Deletes in 3 days')
    expect(t('common.saveFailed', { e: 'x' })).toBe('Couldn’t save: x')
    setLang('ko')
    expect(t('rec.deletesIn', { n: 3 })).toBe('3일 후 삭제')
  })
})

describe('no hard-coded Korean on screen', () => {
  test('every Korean string in code goes through the dictionary', () => {
    const bad = []
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f).split(sep).join('/') // Windows 는 역슬래시로 돌려준다
      if (ALLOWED_FILES.includes(rel)) continue
      for (const s of stringLiterals(readFileSync(f, 'utf8'))) if (HANGUL.test(s.text) && !ALLOWED_TEXT.has(s.text)) bad.push(`${rel}:${s.line} ${s.text.slice(0, 40)}`)
    }
    expect(bad).toEqual([])
  })
  test('the tokenizer sees strings but not comments or regexes', () => {
    const src = "// 주석 '가'\nconst a = '나' /* '다' */; const r = /['\"]/g; const b = `라${x}마`"
    expect(stringLiterals(src).map(s => s.text)).toEqual(['나', '라', '마'])
  })
})

describe('test names are English', () => {
  // 공개 저장소 규칙: 테스트 이름은 영어. 화면의 한국어 표기 자체를 검증하는 이름은 그 표기를 큰따옴표로 싸서 적는다("라4")
  test('no Korean in unit test and e2e scenario names outside double quotes', () => {
    const ROOT = join(SRC, '..', '..')
    const walkTests = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walkTests(p) : /\.test\.(ts|mjs)$/.test(p) ? [p] : [] })
    const files = [...walkTests(SRC), ...walkTests(join(ROOT, 'scripts')), join(ROOT, 'scripts', 'e2e.mjs')]
    const NAME = /\b(?:test|it|describe|scenario)(?:\.each\([^)]*\))?\((['"`])(.*?)\1/g
    const bad = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        for (const m of line.matchAll(NAME)) if (HANGUL.test(m[2].replace(/"[^"]*"/g, ''))) bad.push(`${relative(ROOT, f)}:${i + 1} ${m[2].slice(0, 50)}`)
      })
    }
    expect(bad).toEqual([])
  })
})
