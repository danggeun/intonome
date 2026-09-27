#!/usr/bin/env node
// 아이폰 홈 화면 웹앱의 스플래시 (apple-touch-startup-image). 아이폰은 화면 크기와 배율이 딱 맞는 PNG 가 있을 때만 띄운다(없으면 흰 화면).
// 앱 바탕색 위에 둥근 아이콘 + 한 줄 워드마크. 라이트 · 다크(기기 다크 모드) 두 벌. 아이콘은 resources/icon.svg, 워드마크는 resources/wordmark.svg 에서
// index.html 의 링크 태그는 이 목록과 같아야 한다(scripts/splash.test.mjs). 목록을 바꾸면 `node scripts/gen-splash.mjs --tags` 로 태그를 다시 뽑는다
// 사용: node scripts/gen-splash.mjs [--tags]   (npm run icons 가 아이콘 다음에 부른다). index.html 의 스플래시 → 앱 이음새 블록(launchBlock)도 함께 다시 쓴다
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

/** 워드마크 윤곽: viewBox 와 경로 */
function wordmark() {
  const wm = readFileSync(join(ROOT, 'resources/wordmark.svg'), 'utf8')
  const vb = /viewBox="([^"]+)"/.exec(wm)[1], [, , vw, vh] = vb.split(' ').map(Number)
  return { vb, vw, vh, d: /<path d="([^"]+)"/.exec(wm)[1] }
}

/**
 * 아이폰 홈 화면 웹앱이 스플래시에서 앱으로 넘어갈 때의 이음새. 아이폰은 페이지가 처음 그려지는 순간 스플래시를 치우는데,
 * 그 순간 페이지가 스플래시와 똑같은 그림(같은 아이콘 · 워드마크 · 자리 · 색)을 먼저 그리면 눈에는 바뀌는 게 없다. 앱이 다 그려지면 ui/launch.ts 가 흐리게 걷는다.
 * 아이폰 홈 화면 웹앱(navigator.standalone)에서만 보이고, 다른 곳에서는 첫 그리기 전에 지운다. 무슨 일이 있어도 2.5 초 뒤엔 지운다.
 * 자리: 스플래시는 화면(screen) 기준 47 %. 페이지가 상태바 아래에서 시작하면(위쪽 safe-area 0) 그만큼(screen.height − innerHeight) 올린다
 * index.html 의 <!-- launch:start --> … <!-- launch:end --> 사이에 이 글을 넣는다(손으로 고치지 않는다, splash.test.mjs 가 맞춰 본다)
 */
export function launchBlock() {
  const L = SPLASH_LAYOUT, { vb, vw, vh, d } = wordmark(), wh = L.word * vh / vw, block = L.icon + L.gap + wh
  const icon = readFileSync(join(ROOT, 'resources/icon.svg'), 'utf8').trim()
    .replace(/id="i/g, 'id="lc-i').replace(/url\(#i/g, 'url(#lc-i') // 페이지의 다른 id 와 겹치지 않게
  const { light, dark } = SPLASH_THEMES, n = v => +v.toFixed(2)
  return [
    '<!-- launch:start (scripts/gen-splash.mjs 가 만든다. 아이폰 스플래시 → 앱 이음새) -->',
    `<style>#launch{display:none}#launch.show{display:block;position:fixed;left:0;top:0;width:100%;height:100lvh;z-index:10000;background:${light.bg};transition:opacity .25s ease}#launch.out{opacity:0;pointer-events:none}` +
    `#launch .lc-i{position:absolute;left:50%;width:${L.icon}px;height:${L.icon}px;margin-left:${-L.icon / 2}px;border-radius:50%;overflow:hidden}#launch .lc-i svg{display:block;width:100%;height:100%}` +
    `#launch .lc-w{position:absolute;left:50%;width:${L.word}px;height:${n(wh)}px;margin-left:${-L.word / 2}px;fill:${light.ink}}` +
    `@media (prefers-color-scheme:dark){#launch.show{background:${dark.bg}}#launch .lc-w{fill:${dark.ink}}}</style>`,
    `<div id="launch" aria-hidden="true"><div class="lc-i">${icon}</div><svg class="lc-w" viewBox="${vb}"><path d="${d}"/></svg></div>`,
    `<script>(function(){var e=document.getElementById('launch');try{if(navigator.standalone===true){var H=screen.height,p=document.createElement('div');p.style.cssText='position:fixed;top:0;width:1px;visibility:hidden;height:env(safe-area-inset-top,0px)';document.body.appendChild(p);var t=p.offsetHeight>0?0:Math.max(0,H-innerHeight);p.remove();var y=H*${L.center}-t-${n(block / 2)};e.children[0].style.top=y+'px';e.children[1].style.top=(y+${L.icon + L.gap})+'px';e.className='show';setTimeout(function(){if(e.parentNode)e.remove()},2500);return}}catch(x){}e.remove()})()</script>`,
    '<!-- launch:end -->',
  ].join('\n')
}

function page(w, h, theme) {
  const { bg, ink } = SPLASH_THEMES[theme], L = SPLASH_LAYOUT
  const icon = 'data:image/svg+xml;base64,' + readFileSync(join(ROOT, 'resources/icon.svg')).toString('base64')
  const { vb, vw, vh, d } = wordmark()
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
  // index.html 의 이음새 블록을 지금 아이콘 · 워드마크로 다시 쓴다
  const hp = join(ROOT, 'www/index.html'), html = readFileSync(hp, 'utf8')
  const next = html.replace(/<!-- launch:start[\s\S]*?<!-- launch:end -->/, launchBlock())
  if (next === html && !html.includes(launchBlock())) throw new Error('index.html 에 launch 표식이 없다')
  writeFileSync(hp, next)
  console.log(`splash written: ${SPLASH_DEVICES.length} sizes × 2 themes, launch block in index.html`)
}
