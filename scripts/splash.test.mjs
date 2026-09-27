// 아이폰 스플래시: index.html 의 태그가 목록과 같고, 그림이 태그의 화면 크기 × 배율과 정확히 같고, 모서리가 앱 바탕색인가
import { describe, test, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { PNG } from 'pngjs'
import { SPLASH_DEVICES, SPLASH_THEMES, splashFile, splashTags } from './gen-splash.mjs'

const html = readFileSync(new URL('../www/index.html', import.meta.url), 'utf8')
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))

describe('iPhone home-screen splash images', () => {
  test('index.html links every size in both themes, light first', () => {
    const tags = splashTags()
    for (const t of tags) expect(html, t).toContain(t)
    expect(html.match(/rel="apple-touch-startup-image"/g)?.length).toBe(tags.length)
    expect(html.indexOf('-dark.png')).toBeGreaterThan(html.lastIndexOf('-light.png'))
  })
  test.each(SPLASH_DEVICES.flatMap(([w, h, d, name]) => ['light', 'dark'].map(th => [`${name} ${th}`, w, h, d, th])))('%s', (_, w, h, d, th) => {
    const f = new URL('../www/public/' + splashFile(w, h, d, th), import.meta.url)
    expect(existsSync(f)).toBe(true)
    const p = PNG.sync.read(readFileSync(f))
    expect([p.width, p.height]).toEqual([w * d, h * d])
    const bg = hex(SPLASH_THEMES[th].bg)
    for (const [x, y] of [[0, 0], [p.width - 1, p.height - 1]]) { const i = (y * p.width + x) * 4; expect([p.data[i], p.data[i + 1], p.data[i + 2]]).toEqual(bg) }
    const c = ((Math.round(p.height * 0.47) - 60 * d) * p.width + Math.round(p.width / 2)) * 4 // 아이콘 쪽: 바탕색이 아니다
    expect([p.data[c], p.data[c + 1], p.data[c + 2]]).not.toEqual(bg)
  })
})
