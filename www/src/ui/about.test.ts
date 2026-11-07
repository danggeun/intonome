import { describe, test, expect } from 'vitest'
import { privacyHtml } from './about.ts'

describe('privacy policy page (PRIVACY.md rendered in-app)', () => {
  test('one language per screen: Korean half for ko, English half for en', () => {
    const ko = privacyHtml('ko'), en = privacyHtml('en'), ja = privacyHtml('ja'), zh = privacyHtml('zh-Hans'), zht = privacyHtml('zh-Hant'), es = privacyHtml('es')
    expect(ko).toContain('<h3>마이크</h3>'); expect(ko).not.toContain('Microphone')
    expect(en).toContain('<h3>Microphone</h3>'); expect(en).not.toContain('마이크')
    expect(ja).toContain('<h3>マイク</h3>'); expect(ja).not.toContain('Microphone')
    expect(zh).toContain('<h3>麦克风</h3>'); expect(zh).not.toContain('マイク')
    expect(zht).toContain('<h3>麥克風</h3>'); expect(zht).not.toContain('麦克风')
    expect(es).toContain('<h3>Micrófono</h3>'); expect(es).not.toContain('Microphone')
  })
  test('markdown is turned into HTML: headings, lists, bold, bare URLs; no markdown syntax left', () => {
    const en = privacyHtml('en')
    expect(en.startsWith('<p class="doc-meta">Last updated: ')).toBe(true)
    expect(en).toMatch(/<ul><li>Mic input is <strong>analyzed in real time and discarded immediately<\/strong>/)
    expect(en).toContain('<a href="https://github.com/danggeun/intonome/issues" target="_blank" rel="noopener">https://github.com/danggeun/intonome/issues</a>')
    expect(en).toContain('<a href="mailto:intonome.app@gmail.com">intonome.app@gmail.com</a>') // 스토어와 같은 연락처
    expect(en).not.toMatch(/\*\*|^#|\n- |\[한국어\]|&lt;https/m)
    expect(en).not.toContain('<h1') // the page title is the screen title
  })
  test('the document title and the language-switch link are dropped', () => {
    const ko = privacyHtml('ko')
    expect(ko).not.toContain('Intonome 개인정보처리방침'); expect(ko).not.toContain('한국어]')
    expect(privacyHtml('en')).not.toContain(' · ')
  })
})
