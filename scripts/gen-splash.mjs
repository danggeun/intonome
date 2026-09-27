#!/usr/bin/env node
// 아이폰 홈 화면 웹앱의 스플래시 (apple-touch-startup-image). 아이폰은 화면 크기와 배율이 딱 맞는 PNG 가 있을 때만 띄운다(없으면 흰 화면).
// 앱 바탕색 위에 둥근 아이콘 + 한 줄 워드마크. 라이트 · 다크(기기 다크 모드) 두 벌. 아이콘은 resources/icon.svg, 워드마크는 resources/wordmark.svg 에서
// index.html 의 링크 태그는 이 목록과 같아야 한다(scripts/splash.test.mjs). 목록을 바꾸면 `node scripts/gen-splash.mjs --tags` 로 태그를 다시 뽑는다
// 사용: node scripts/gen-splash.mjs [--tags]   (npm run icons 가 아이콘 다음에 부른다)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** 세로 화면 [CSS 폭, CSS 높이, 배율, 기종]. 같은 크기는 한 장으로 */
export const SPLASH_DEVICES = [
  [440, 956, 3, 'iPhone 16 Pro Max · 17 Pro Max · 18 Pro Max'],
  [420, 912, 3, 'iPhone Air'],
  [402, 874, 3, 'iPhone 16 Pro · 17 · 17 Pro · 18 Pro'],
  [430, 932, 3, 'iPhone 14 Pro Max · 15 Plus · 15 Pro Max · 16 Plus'],
  [393, 852, 3, 'iPhone 14 Pro · 15 · 15 Pro · 16'],
  [428, 926, 3, 'iPhone 12 Pro Max · 13 Pro Max · 14 Plus'],
  [390, 844, 3, 'iPhone 12 · 12 Pro · 13 · 13 Pro · 14 · 16e'],
  [375, 812, 3, 'iPhone X · XS · 11 Pro · 12 mini · 13 mini'],
  [414, 896, 3, 'iPhone XS Max · 11 Pro Max'],
  [414, 896, 2, 'iPhone XR · 11'],
  [414, 736, 3, 'iPhone 8 Plus'],
  [375, 667, 2, 'iPhone 8 · SE (2nd, 3rd)'],
]
/** 앱 바탕색과 같다(스타일 --bg). 다크는 기기가 다크 모드일 때 */
export const SPLASH_THEMES = { light: { bg: '#EEF0F3', ink: '#1B1F25' }, dark: { bg: '#181B21', ink: '#FFFFFF' } }
/** 크기(pt): 아이콘 지름, 워드마크 폭, 둘 사이. 묶음의 가운데를 화면 높이의 47 % 에(홈 막대 쪽이 무거워 보이지 않게 조금 위로) */
export const SPLASH_LAYOUT = { icon: 120, word: 150, gap: 26, center: 0.47 }

export const splashFile = (w, h, d, theme) => `splash/iphone-${w * d}x${h * d}-${theme}.png`
/** 라이트 태그를 먼저, 다크는 prefers-color-scheme 을 붙여 뒤에(아이폰은 뒤의 맞는 태그를 쓴다) */
export const splashMedia = (w, h, d, theme) =>
  `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)${theme === 'dark' ? ' and (prefers-color-scheme: dark)' : ''}`
export const splashTags = () => ['light', 'dark'].flatMap(th => SPLASH_DEVICES.map(([w, h, d]) =>
  `<link rel="apple-touch-startup-image" media="${splashMedia(w, h, d, th)}" href="${splashFile(w, h, d, th)}">`))

function page(w, h, theme) {
  const { bg, ink } = SPLASH_THEMES[theme], L = SPLASH_LAYOUT
  const icon = 'data:image/svg+xml;base64,' + readFileSync(join(ROOT, 'resources/icon.svg')).toString('base64')
  const wm = readFileSync(join(ROOT, 'resources/wordmark.svg'), 'utf8')
  const vb = /viewBox="([^"]+)"/.exec(wm)[1], [, , vw, vh] = vb.split(' ').map(Number), d = /<path d="([^"]+)"/.exec(wm)[1]
  const wh = L.word * vh / vw, block = L.icon + L.gap + wh, top = h * L.center - block / 2
  return `<!doctype html><html><head><style>html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}</style></head><body>
<img src="${icon}" style="position:absolute;left:${(w - L.icon) / 2}px;top:${top}px;width:${L.icon}px;height:${L.icon}px;border-radius:50%">
<svg viewBox="${vb}" style="position:absolute;left:${(w - L.word) / 2}px;top:${top + L.icon + L.gap}px;width:${L.word}px;height:${wh}px"><path fill="${ink}" d="${d}"/></svg>
</body></html>`
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--tags')) { console.log(splashTags().join('\n')); process.exit(0) }
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  mkdirSync(join(ROOT, 'www/public/splash'), { recursive: true })
  for (const theme of ['light', 'dark']) for (const [w, h, d] of SPLASH_DEVICES) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: d })
    await p.setContent(page(w, h, theme)); await p.evaluate(() => Promise.all([...document.images].map(i => i.decode())))
    writeFileSync(join(ROOT, 'www/public', splashFile(w, h, d, theme)), await p.screenshot({ type: 'png' })); await p.close()
  }
  await browser.close()
  console.log(`splash written: ${SPLASH_DEVICES.length} sizes × 2 themes`)
}
