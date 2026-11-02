#!/usr/bin/env node
// Play 스토어 이미지 — 폰 스크린샷(1080×2160, 한국어·영어)과 피처 그래픽(1024×500). 앱을 실제로 조작해서 찍는다(가짜 마이크에 연주 WAV).
// 사용: npm run store:assets  → test-assets/store/ (커밋하지 않는다 — 다시 만들 수 있다)
// Play 규격: 폰 스크린샷은 긴 변이 짧은 변의 2배 이하, 320–3840 px, PNG(알파 없음)/JPEG. 피처 그래픽은 1024×500
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { waitForServer } from './lib/wait-server.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test-assets', 'store')
const SIG = join(ROOT, 'test-assets', 'signals')
const PORT = 4174
mkdirSync(OUT, { recursive: true })
if (!existsSync(join(SIG, 'violin_A4.wav'))) execSync('node scripts/gen-signals.mjs', { cwd: ROOT, stdio: 'ignore' })
execSync('npm run build:cap', { cwd: ROOT, stdio: 'ignore' }) // base=/ — 가짜 마이크가 잡히는 빌드(e2e 와 같다)
const server = spawn('npx', ['-y', 'serve', '-s', '-l', String(PORT), 'dist'], { cwd: ROOT, stdio: 'ignore', detached: process.platform !== 'win32', shell: process.platform === 'win32' })
const killServer = () => { try { process.kill(-server.pid, 'SIGTERM') } catch { try { server.kill() } catch { /* */ } } }
process.on('exit', killServer); process.on('uncaughtException', e => { console.error(e); killServer(); process.exit(1) })
await waitForServer(`http://localhost:${PORT}/`)

// 360×720 CSS px × 3 = 1080×2160 (2:1)
const VIEW = { width: 360, height: 720 }, SCALE = 3
const launch = wav => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${join(SIG, wav)}`, '--autoplay-policy=no-user-gesture-required'] })
const sleep = (p, ms) => p.waitForTimeout(ms)
/** 음이름이 떠 있을 때까지 — 가짜 마이크의 WAV 는 반복되며 사이에 틈이 있다 */
const waitNote = async (p, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(() => !document.getElementById('tuner-note').classList.contains('empty'))) { await sleep(p, 900); return } await sleep(p, 100) } }
const settled = p => sleep(p, 900)
const TEXT = {
  ko: { recName: 'C장조 스케일', tag: '현악기 연습을 위한 튜너 · 메트로놈 · 드론 · 녹음' },
  en: { recName: 'C major scale', tag: 'Tuner, metronome, drone and recorder for string players' },
}

async function page(browser, lang, theme, extra = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, permissions: ['microphone'] })
  // 처음 안내는 저장된 설정이 있으면 뜨지 않는다(업데이트 설치와 같은 조건)
  await ctx.addInitScript(s => { if (!localStorage.getItem('intonome_settings_v1')) localStorage.setItem('intonome_settings_v1', JSON.stringify(s)) }, { v: 3, lang, theme, noteNames: lang, ...extra })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${PORT}/`); await p.evaluate(() => document.fonts.ready); await sleep(p, 1200)
  return p
}
/** 알파 채널을 뺀 24-bit PNG 로 저장 — Play 는 알파가 있는 스크린샷을 받지 않는다 */
function writeRgb(file, buf) {
  const png = PNG.sync.read(buf), out = new PNG({ width: png.width, height: png.height, colorType: 2, inputHasAlpha: true })
  png.data.copy(out.data); writeFileSync(file, PNG.sync.write(out, { colorType: 2, inputHasAlpha: true }))
}
const shot = async (p, name) => {
  await p.evaluate(() => document.getElementById('toast-host')?.replaceChildren()) // 안내 토스트가 화면을 가리지 않게
  writeRgb(join(OUT, name + '.png'), await p.screenshot())
  console.log('  ' + name)
}

for (const lang of ['ko', 'en']) {
  console.log(lang)
  const L = TEXT[lang], n = k => `${lang}_${k}`
  // 1. 조율: A = 440 에 바이올린 A — 맞음(초록)과 비브라토 트레이스
  let b = await launch('violin_A4.wav'); let p = await page(b, lang, 'dark', { refHz: 440 })
  await sleep(p, 2500); await waitNote(p); await shot(p, n('1_tuner'))
  // 2. 메트로놈 펼침 — 튜너와 함께, 3/4 셋잇단, 재생 중
  await p.click('#metro-size-btn'); await settled(p)
  await p.click('.m-seg[data-ts="3"]'); await p.click('.m-seg[data-sd="3"]')
  await p.click('#metro-play-btn'); await sleep(p, 600); await waitNote(p); await shot(p, n('2_metronome'))
  // 3. 메트로놈만 크게 — 다이얼, 96 BPM
  await p.click('#metro-full-btn'); await settled(p)
  for (let i = 0; i < 16; i++) await p.click('.m-adj[data-t-aria="metro.bpmUp"]')
  await sleep(p, 1200); await shot(p, n('3_metronome_full'))
  await b.close()
  // 4. 드론 위에서 스케일 — 첼로 다장조 + 드론 도
  b = await launch('cello_scale_Cmaj.wav'); p = await page(b, lang, 'dark')
  await sleep(p, 600); await p.click('#drone-btn'); await p.click('.drone-note-btn[data-pc="0"]')
  await sleep(p, 3500); await waitNote(p); await shot(p, n('4_drone_scale'))
  await p.click('#drone-btn') // 드론 끄기
  // 5. 녹음 → 편집기: A-B 반복, 북마크, 0.85×
  await p.click('#menu-btn'); await p.click('#timer-toggle-btn'); await p.click('.menu-close-btn')
  await p.click('#rec-hdr-btn'); await sleep(p, 9000); await p.click('#rec-hdr-btn'); await sleep(p, 1500)
  await p.click('#menu-btn'); await sleep(p, 500)
  await p.click('[data-action="edit"][data-idx="0"]'); await sleep(p, 1500)
  p.once('dialog', d => d.accept(L.recName)); await p.click('#ed-title-edit'); await sleep(p, 300)
  await p.evaluate(() => { window.__tt.editor().audio.currentTime = 1.6 }); await p.click('#ed-a-btn')
  await p.evaluate(() => { window.__tt.editor().audio.currentTime = 6.2 }); await p.click('#ed-b-btn')
  await p.click('#ed-loop-btn')
  await p.evaluate(() => { window.__tt.editor().audio.currentTime = 3.4 }); await p.click('#ed-bm-add-btn')
  for (let i = 0; i < 3; i++) await p.click('#ed-speed-val') // 1.0 → 0.5 → 0.7 → 0.85
  await p.evaluate(() => { window.__tt.editor().audio.currentTime = 4.1 }); await sleep(p, 800)
  await shot(p, n('5_editor'))
  // 6. 메뉴 — 연습 타이머와 녹음 목록
  await p.click('#ed-back-btn'); await sleep(p, 900); await shot(p, n('6_menu'))
  await b.close()
  // 7. 라이트 화면 — 밝은 곳에서
  b = await launch('violin_A4.wav'); p = await page(b, lang, 'light', { refHz: 440 })
  await sleep(p, 2500); await waitNote(p); await shot(p, n('7_tuner_light'))
  await b.close()
}

// 피처 그래픽 1024×500 — 아이콘 · 워드마크 · 한 줄 · 조율 화면 일부. 알파 없음
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const banner = readFileSync(join(ROOT, 'docs', 'banner-dark.svg'), 'utf8')
const iconSvg = banner.match(/<g clip-path="url\(#cdark\)">[\s\S]*?<\/g><\/g>/)?.[0] ?? ''
const wordmark = readFileSync(join(ROOT, 'resources', 'wordmark.svg'), 'utf8')
for (const lang of ['ko', 'en']) {
  const shotB64 = readFileSync(join(OUT, `${lang}_1_tuner.png`)).toString('base64')
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#181B21;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif}
    .icon{position:absolute;left:72px;top:118px;width:132px;height:132px;border-radius:30px;overflow:hidden}
    .icon svg{width:132px;height:132px}
    .wm{position:absolute;left:72px;top:282px;width:300px;fill:#fff}
    .wm svg{width:300px;height:auto;fill:#fff}
    .tl{position:absolute;left:74px;top:344px;color:#E8EAED;font-size:26px;letter-spacing:.2px}
    .sub{position:absolute;left:74px;top:388px;color:#9AA0A8;font-size:19px}
    .ph{position:absolute;right:76px;top:46px;width:282px;height:520px;border-radius:34px;border:6px solid #2E333C;overflow:hidden;background:#0d0f13}
    .ph img{width:100%;display:block}
  </style>
  <div class="icon"><svg viewBox="147.075 84 232 232">${iconSvg}</svg></div>
  <div class="wm">${wordmark}</div>
  <div class="tl">in tune, in time.</div>
  <div class="sub">${TEXT[lang].tag}</div>
  <div class="ph"><img src="data:image/png;base64,${shotB64}"></div>`)
  await sleep(p, 300)
  const file = join(OUT, `${lang}_feature_1024x500.png`)
  writeRgb(file, await p.screenshot())
  console.log('  ' + `${lang}_feature_1024x500`)
  await ctx.close()
}
await browser.close()
// 스토어 아이콘: 512×512, 알파 채널 있는 32-bit PNG (Play 규격) — 앱 아이콘 원본을 RGBA 로
{ const png = PNG.sync.read(readFileSync(join(ROOT, 'www', 'public', 'icons', 'icon-512.png'))); writeFileSync(join(OUT, 'icon_512.png'), PNG.sync.write(png, { colorType: 6 })); console.log('  icon_512') }
killServer()
console.log(`\n${OUT}`)
