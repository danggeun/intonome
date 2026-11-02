import { describe, test, expect } from 'vitest'
import { privacyHtml } from './about.ts'

describe('privacy policy page (PRIVACY.md rendered in-app)', () => {
  test('one language per screen: Korean half for ko, English half for en', () => {
    const ko = privacyHtml(true), en = privacyHtml(false)
    expect(ko).toContain('<h3>마이크</h3>'); expect(ko).not.toContain('Microphone')
    expect(en).toContain('<h3>Microphone</h3>'); expect(en).not.toContain('마이크')
  })
  test('markdown is turned into HTML: headings, lists, bold, bare URLs; no markdown syntax left', () => {
    const en = privacyHtml(false)
    expect(en.startsWith('<p class="doc-meta">Last updated: ')).toBe(true)
    expect(en).toMatch(/<ul><li>Mic input is <strong>analyzed in real time and discarded immediately<\/strong>/)
    expect(en).toContain('<a href="https://github.com/danggeun/intonome/issues" target="_blank" rel="noopener">https://github.com/danggeun/intonome/issues</a>')
    expect(en).not.toMatch(/\*\*|^#|\n- |\[한국어\]|&lt;https/m)
    expect(en).not.toContain('<h1') // the page title is the screen title
  })
  test('the document title and the language-switch link are dropped', () => {
    const ko = privacyHtml(true)
    expect(ko).not.toContain('Intonome 개인정보처리방침'); expect(ko).not.toContain('한국어]')
    expect(privacyHtml(false)).not.toContain(' · ')
  })
})
