#!/usr/bin/env node
// Play 스토어 이미지 — 폰 스크린샷 5장(1080×2160, 한국어·영어), 피처 그래픽(1024×500), 스토어 아이콘(512). 앱을 실제로 조작해서 찍는다(가짜 마이크에 합성 연주).
// 사용: npm run store:assets  → test-assets/store/ (커밋하지 않는다 — 다시 만들 수 있다)
// Play 규격: 폰 스크린샷은 긴 변이 짧은 변의 2배 이하, 320–3840 px, PNG(알파 없음)/JPEG. 피처 그래픽은 1024×500
//
// 장면과 문구(docs/STORE.md 의 Graphics 절과 같아야 한다):
//   1 튜너 — 라, 비브라토 궤적            4 드론 도 + 솔(완전5도, 맞음)
//   2 튜너+메트로놈 — 라, 비브라토 없음(4/4 ♫)  5 라이트 테마
//   3 메트로놈 전용 — 마디 첫 박 치는 순간
// 한국어 세트는 A=442(국내 오케스트라·레슨 기준), 영어 세트는 440. 소리는 그 기준음으로 합성한다
import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { waitForServer } from './lib/wait-server.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'test-assets', 'store')
const SIG = join(OUT, 'signals') // 스토어 전용 합성음 — test-assets/signals 는 벤치가 전부 읽으므로 거기 두지 않는다
const PORT = 4174
mkdirSync(SIG, { recursive: true })

// ── 합성음: 활 현악기 톤(배음 1/n^1.1, 활 잡음 약간). gen-signals.mjs 와 같은 모델을 작게 ──
const SR = 48000
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 - 0.5 } // 재현 가능한 잡음
/** f0Fn(t)→Hz. vib: 비브라토(Hz, 센트, 시작 시각, 커지는 데 걸리는 시간) — 실제 연주처럼 곧게 내다가 서서히 들어온다 */
function bowed(f0Fn, sec, { vibHz = 5.2, vibCents = 0, vibDelay = 0.6, vibRise = 0.5, jitterCents = 1.5, attack = 0.08, release = 0.15, amp = 0.35 } = {}) {
  const n = Math.round(sec * SR), out = new Float32Array(n), nH = 16
  let ph = 0, jit = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const grow = t > vibDelay ? Math.min(1, (t - vibDelay) / vibRise) : 0
    const vib = grow * vibCents * Math.sin(2 * Math.PI * vibHz * (t - vibDelay))
    jit = 0.999 * jit + rnd() * 0.02 * jitterCents
    const f = f0Fn(t) * Math.pow(2, (vib + jit) / 1200)
    ph += (2 * Math.PI * f) / SR
    let s = 0
    for (let h = 1; h <= nH; h++) { if (f * h > SR / 2) break; s += Math.sin(ph * h) / Math.pow(h, 1.1) * (h % 2 === 0 ? 0.79 : 1) }
    const env = Math.min(1, i / (attack * SR), (n - i) / (release * SR))
    out[i] = (s * 0.5 + rnd() * 0.01) * env * amp
  }
  return out
}
const silence = sec => new Float32Array(Math.round(sec * SR))
const concat = (...parts) => { const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length } return out }
function writeWav(file, data) {
  const b = Buffer.alloc(44 + data.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + data.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(data.length * 2, 40)
  for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-1, Math.min(1, data[i])) * 32767, 44 + i * 2)
  writeFileSync(file, b)
}
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const hz = (name, ref) => ref * Math.pow(2, (NOTE[name[0]] + (parseInt(name.slice(1)) + 1) * 12 - 69) / 12)
/** 기준음별 소리 세 개 — 깔끔하게, 그러나 기계가 아니라 사람이 낸 것처럼(미세한 흔들림만)
 *  a: 바이올린 라 — 긴 음, 고른 비브라토가 처음부터 끝까지(궤적이 끊기거나 중간에 모양이 바뀌지 않게 — 한 장면은 한 가지만)
 *  s: 바이올린 라 — 긴 음, 비브라토 없음, 정확(스케일을 들려주면 음이 바뀔 때마다 궤적에 꺾임이 남는다 — 그림은 곧은 선 하나가 낫다)
 *  d: 드론 위의 솔(완전5도) — 긴 음, 정확. 궤적은 곧은 선 하나(문구가 장면을 말하고, 그림은 깔끔하게)
 *  합성음을 사람처럼 비틀면 각지고 어색해 보인다 — 정확한 음이 더 낫다(사용자 결정) */
function makeSignals(ref) {
  const a = join(SIG, `violin_A4_${ref}.wav`), s = join(SIG, `cello_Cmaj_${ref}.wav`), d = join(SIG, `cello_G2_drone_${ref}.wav`)
  writeWav(a, concat(silence(0.3), bowed(() => hz('A4', ref), 9, { vibCents: 12, vibDelay: 0, vibRise: 0.01 }), silence(0.5)))
  writeWav(s, concat(silence(0.3), bowed(() => hz('A4', ref), 9, { jitterCents: 0.5 }), silence(0.5)))
  writeWav(d, concat(silence(0.3), bowed(() => hz('G2', ref), 9, { amp: 0.4, jitterCents: 0.5 }), silence(0.5)))
  return { a, s, d }
}

execSync('npm run build:cap', { cwd: ROOT, stdio: 'ignore' }) // base=/ — 가짜 마이크가 잡히는 빌드(e2e 와 같다)
const server = spawn('npx', ['-y', 'serve', '-s', '-l', String(PORT), 'dist'], { cwd: ROOT, stdio: 'ignore', detached: process.platform !== 'win32', shell: process.platform === 'win32' })
const killServer = () => { try { process.kill(-server.pid, 'SIGTERM') } catch { try { server.kill() } catch { /* */ } } }
process.on('exit', killServer); process.on('uncaughtException', e => { console.error(e); killServer(); process.exit(1) })
await waitForServer(`http://localhost:${PORT}/`)

// 360×720 CSS px × 3 = 1080×2160 (2:1)
const VIEW = { width: 360, height: 720 }, SCALE = 3
const launch = wav => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`, '--autoplay-policy=no-user-gesture-required'] })
const sleep = (p, ms) => p.waitForTimeout(ms)
const noteText = p => p.evaluate(() => { const n = document.getElementById('tuner-note'); return n.classList.contains('empty') ? '' : n.textContent.trim() })
/** 음이 떠 있을 때까지(원하는 음이 있으면 그 음까지) — 가짜 마이크의 WAV 는 반복되며 사이에 틈이 있다 */
async function waitNote(p, want = null, ms = 12000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { const n = await noteText(p); if (n && (!want || n.startsWith(want))) return; await sleep(p, 40) }
  console.warn(`  (note ${want ?? 'any'} not seen within ${ms} ms — shooting anyway)`)
}
const settled = p => sleep(p, 900)

// 문구 — 그림이 못 보여주는 것만, 한 번에 읽히는 길이. 영어는 번역이 아니라 같은 장면을 영어로 쓴 것
const CAPTIONS = {
  ko: [
    ['비브라토가 보이는 튜너', '현악기 튜너 · 메트로놈'],
    ['튜너와 메트로놈을 한 화면에', '메트로놈 켜 둔 채 음정 확인'],
    ['메트로놈만 크게', '2/4~6/8 · 셋잇단 · 템포 ±5'],
    ['드론 켜 놓고 음정 잡기', '드론 소리는 빼고 연주하는 음만 읽어요'],
    ['라이트 테마도', '광고 없음 · 오프라인 · 무료'],
  ],
  en: [
    ['Tuner that shows vibrato', 'Tuner & metronome for strings'],
    ['Tuner and metronome', 'Check pitch with the click running'],
    ['Metronome, full size', '2/4–6/8 · triplets · ±5 BPM'],
    ['Play against a drone', 'It hears you, not the drone'],
    ['Light theme too', 'No ads · Offline · Free'],
  ],
  // 일본어·중국어는 낱말 경계가 없어 긴 제목이 아무 데서나 꺾인다 — 꺾을 자리를 <br> 로 정한다
  ja: [
    ['ビブラートが見える<br>チューナー', '弦楽器のチューナー・メトロノーム'],
    ['チューナーと<br>メトロノームを1画面に', 'メトロノームを鳴らしたまま音程を確認'],
    ['メトロノームだけを大きく', '2/4〜6/8 · 3連符 · テンポ ±5'],
    ['ドローンを鳴らして<br>音程合わせ', 'ドローンの音は拾わず、<br>演奏した音だけを読みます'],
    ['ライトテーマも', '広告なし · オフライン · 無料'],
  ],
  'zh-Hans': [
    ['能看见揉弦的调音器', '弦乐调音器 · 节拍器'],
    ['调音器和节拍器<br>在同一屏', '开着节拍器看音准'],
    ['放大节拍器', '2/4–6/8 · 三连音 · 速度 ±5'],
    ['开着持续音练音准', '只听你的音，不听持续音'],
    ['也有浅色主题', '无广告 · 离线 · 免费'],
  ],
  'zh-Hant': [
    ['看得見揉弦的調音器', '弦樂調音器 · 節拍器'],
    ['調音器和節拍器<br>在同一個畫面', '開著節拍器看音準'],
    ['放大節拍器', '2/4–6/8 · 三連音 · 速度 ±5'],
    ['開著持續音練音準', '只聽你的音，不聽持續音'],
    ['也有淺色主題', '無廣告 · 離線 · 免費'],
  ],
}
const TAG = { ko: '현악기 연습을 위한 튜너 · 메트로놈 · 드론 · 녹음', en: 'Tuner, metronome, drone and recorder for string players', ja: '弦楽器の練習のためのチューナー · メトロノーム · ドローン · 録音', 'zh-Hans': '为弦乐练习设计的调音器 · 节拍器 · 持续音 · 录音', 'zh-Hant': '為弦樂練習設計的調音器 · 節拍器 · 持續音 · 錄音' }
const REF = { ko: 442, en: 440, ja: 442, 'zh-Hans': 440, 'zh-Hant': 442 } // 일본 오케스트라도 442 가 흔하다, 중국은 440
const FONT = { ko: "'Noto Sans CJK KR','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',system-ui,sans-serif", en: "system-ui,-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif", ja: "'Noto Sans CJK JP','Noto Sans JP','Hiragino Sans','Yu Gothic',system-ui,sans-serif", 'zh-Hans': "'Noto Sans CJK SC','Noto Sans SC','PingFang SC','Microsoft YaHei',system-ui,sans-serif", 'zh-Hant': "'Noto Sans CJK TC','Noto Sans TC','PingFang TC','Microsoft JhengHei',system-ui,sans-serif" }
const LANGS = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant']
const TAG_OF = { ko: 'ko', en: 'en', ja: 'ja', 'zh-Hans': 'zh', 'zh-Hant': 'zht' } // 파일 이름 앞머리

async function page(browser, lang, theme, extra = {}) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, permissions: ['microphone'] })
  // 처음 안내는 저장된 설정이 있으면 뜨지 않는다(업데이트 설치와 같은 조건)
  await ctx.addInitScript(s => { if (!localStorage.getItem('intonome_settings_v1')) localStorage.setItem('intonome_settings_v1', JSON.stringify(s)) }, { v: 3, lang, theme, noteNames: lang, refHz: REF[lang], ...extra })
  const p = await ctx.newPage()
  await p.goto(`http://localhost:${PORT}/`); await p.evaluate(() => document.fonts.ready); await sleep(p, 1200)
  return p
}
/** 알파 채널을 뺀 24-bit PNG 로 저장 — Play 는 알파가 있는 스크린샷을 받지 않는다 */
function writeRgb(file, buf) {
  const png = PNG.sync.read(buf), out = new PNG({ width: png.width, height: png.height, colorType: 2, inputHasAlpha: true })
  png.data.copy(out.data); writeFileSync(file, PNG.sync.write(out, { colorType: 2, inputHasAlpha: true }))
}
/** 앱 화면만 찍는다(토스트 치우고). 합성은 compose() */
const raw = async p => { await p.evaluate(() => document.getElementById('toast-host')?.replaceChildren()); return p.screenshot() }
/** 튜너 궤적이 보이는 범위에서 끊긴 데 없이 이어져 있나 — 추적기가 한 프레임 놓치면 선에 틈이 생기는데, 사진에서는 결함으로 읽힌다 */
const traceContinuous = p => p.evaluate(() => {
  const cv = document.getElementById('tuner-history-cv'), box = document.getElementById('tuner-history'); if (!cv || !box) return true
  const c = cv.getContext('2d'), scale = cv.height / Math.max(1, cv.getBoundingClientRect().height)
  const h = Math.min(cv.height, Math.round(box.getBoundingClientRect().height * scale)), top = cv.height - h // 캔버스는 아래가 최신, 보이는 건 아래쪽 h
  const d = c.getImageData(0, top, cv.width, h).data, rows = []
  // 선 = 그 줄의 바탕(맨 왼쪽 픽셀)과 밝기가 110 넘게 다른 픽셀. 가운데 기준선(잉크 38 %)과 허용 띠는 그보다 연하다. 다크·라이트 모두
  const lum = i => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11
  for (let y = 0; y < h; y++) { const bg = lum(y * cv.width * 4); let lit = false; for (let x = 0; x < cv.width; x++) { if (Math.abs(lum((y * cv.width + x) * 4) - bg) > 110) { lit = true; break } } rows.push(lit) }
  // 위쪽(오래된 부분)은 옅어져 판정이 흔들린다 — 아래 65 %(최근 몇 초)만 본다: 선이 끝까지 닿아 있고 그 안에 빈 줄이 없어야 한다
  const recent = rows.slice(Math.floor(h * 0.35)), gaps = recent.filter(r => !r).length
  return { ok: recent[recent.length - 1] && gaps === 0, why: `h ${h} gaps(bottom 65%) ${gaps} lastLit ${recent[recent.length - 1]}` }
})
/** 끊김 없는 궤적이 나올 때까지 몇 번 다시 찍는다 */
async function rawTrace(p, tries = 6) {
  let r
  for (let i = 0; i < tries; i++) { r = await traceContinuous(p); if (r.ok) return raw(p); if (process.env.STORE_DEBUG) console.log('   trace: ' + r.why); await sleep(p, 1500) }
  console.warn('  (trace never continuous — shooting anyway: ' + r.why + ')'); return raw(p)
}

// 스토어 이미지 = 문구 + 폰 틀 안의 앱 화면. 틀은 화면 비율(1:2) 그대로라 아래가 비지 않고, 아래 끝은 이미지 밖으로 이어진다
let composer // 합성용 브라우저 컨텍스트(가짜 마이크 없음)
async function compose(lang, idx, shotBuf, name) {
  const [title, sub] = CAPTIONS[lang][idx]
  const p = await composer.newPage()
  await p.setContent(`<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:360px;height:720px;overflow:hidden;background:radial-gradient(120% 60% at 50% 0%,#2a3040,#14161b);font-family:${FONT[lang]};color:#fff;text-align:center}
    h1{font-size:${lang === 'en' ? 25 : 27}px;font-weight:700;margin:36px 20px 8px;letter-spacing:-.3px;line-height:1.3}
    p{margin:0 20px;font-size:14px;color:#aeb4bd;line-height:1.4}
    /* 폰 틀은 글 아래 흐름에, 통째로 보이게(위 36 · 아래 약 30 px 여백). 틀 안은 앱 화면 비율(1:2) 그대로라 빈 데가 없다 */
    .ph{margin:18px auto 0;width:280px;border-radius:32px;border:6px solid #353b48;background:#353b48;overflow:hidden;box-shadow:0 18px 44px #0008}
    .ph img{width:100%;display:block;border-radius:26px}
  </style><h1>${title}</h1><p>${sub}</p><div class="ph"><img src="data:image/png;base64,${shotBuf.toString('base64')}"></div>`)
  await p.evaluate(() => document.fonts.ready); await sleep(p, 150)
  writeRgb(join(OUT, name + '.png'), await p.screenshot())
  await p.close()
  console.log('  ' + name)
}
/** 메트로놈을 "마디 첫 박을 치는 순간"으로 고정해 찍는다 — 재생 중엔 LED 가 매 프레임 바뀌어 원하는 순간을 잡을 수 없으므로,
 *  멈춘 뒤 그 순간의 모습(쓸고 가는 불이 왼쪽 끝에 닿아 강박 색, 버튼은 ■)을 ui/metro.ts 와 같은 클래스·글리프로 그린다. 화면 전용 */
const freezeDownbeat = async p => {
  await p.click('#metro-play-btn'); await sleep(p, 300)
  await p.evaluate(() => {
    for (const id of ['sweep-leds', 'beat-vis']) {
      const leds = Array.from(document.querySelectorAll(`#${id} .led`)); if (!leds.length) continue
      leds.forEach(l => { l.className = 'led' }); leds[0].className = 'led mv hit-acc'
    }
    for (const id of ['metro-play-btn', 'metro-play-hdr-btn']) { const b = document.getElementById(id); if (b) b.innerHTML = '<svg class="tp-glyph" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="2"/></svg>' }
  })
}

composer = await (await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })).newContext({ viewport: VIEW, deviceScaleFactor: SCALE })
const featureShot = {}
for (const lang of LANGS) {
  console.log(lang)
  const sig = makeSignals(REF[lang]), n = k => `${TAG_OF[lang]}_${k}`
  // 1. 조율: 바이올린 라 — 맞음(초록), 곧게 내다가 비브라토가 들어온 궤적
  let b = await launch(sig.a); let p = await page(b, lang, 'dark')
  await waitNote(p); await sleep(p, 4500); featureShot[lang] = await rawTrace(p); await compose(lang, 0, featureShot[lang], n('1_tuner'))
  await b.close()
  // 2. 튜너 + 메트로놈 펼침 — 라를 곧게, 4/4 ♫ 재생 중
  b = await launch(sig.s); p = await page(b, lang, 'dark')
  await p.click('#metro-size-btn'); await settled(p)
  await p.click('.m-seg[data-sd="2"]') // 4/4, 8분음표 분할 — 가장 흔한 설정(셋잇단은 보여 주기용이지 평소 모습이 아니다)
  await p.click('#metro-play-btn'); await waitNote(p); await sleep(p, 4500); await compose(lang, 1, await rawTrace(p), n('2_metronome'))
  // 3. 메트로놈만 크게 — 다이얼 96, 마디 첫 박 치는 순간
  await p.click('#metro-full-btn'); await settled(p)
  for (let i = 0; i < 16; i++) await p.click('.m-adj[data-t-aria="metro.bpmUp"]')
  await sleep(p, 1200); await freezeDownbeat(p); await compose(lang, 2, await raw(p), n('3_metronome_full'))
  await b.close()
  // 4. 드론 도 위에서 스케일 — 솔(완전5도)이 맞은 순간. 드론이 울려도 연주하는 음만 읽는다
  b = await launch(sig.d); p = await page(b, lang, 'dark')
  await p.click('#drone-btn'); await p.click('.drone-note-btn[data-pc="0"]')
  await waitNote(p, { ko: '솔', ja: 'ソ' }[lang] ?? 'G'); await sleep(p, 4500); await compose(lang, 3, await rawTrace(p), n('4_drone'))
  await b.close()
  // 5. 라이트 테마 — 밝은 곳에서
  b = await launch(sig.a); p = await page(b, lang, 'light')
  await waitNote(p); await sleep(p, 4500); await compose(lang, 4, await rawTrace(p), n('5_light'))
  await b.close()
}

// 피처 그래픽 1024×500 — 아이콘 · 워드마크 · 한 줄 · 조율 화면 일부. 알파 없음. 폰에서는 홍보 영상이 있을 때만 보이지만 필수 항목
{
  const banner = readFileSync(join(ROOT, 'docs', 'banner-dark.svg'), 'utf8')
  const iconSvg = banner.match(/<g clip-path="url\(#cdark\)">[\s\S]*?<\/g><\/g>/)?.[0] ?? ''
  const wordmark = readFileSync(join(ROOT, 'resources', 'wordmark.svg'), 'utf8')
  const ctx = await composer.browser().newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 })
  for (const lang of LANGS) {
    const p = await ctx.newPage()
    await p.setContent(`<!doctype html><meta charset="utf-8"><style>
      html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#181B21;font-family:${FONT[lang]}}
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
    <div class="sub">${TAG[lang]}</div>
    <div class="ph"><img src="data:image/png;base64,${featureShot[lang].toString('base64')}"></div>`)
    await sleep(p, 300)
    writeRgb(join(OUT, `${TAG_OF[lang]}_feature_1024x500.png`), await p.screenshot())
    console.log('  ' + `${TAG_OF[lang]}_feature_1024x500`)
    await p.close()
  }
  await ctx.close()
}
await composer.browser().close()
// 스토어 아이콘: 512×512, 알파 채널 있는 32-bit PNG (Play 규격) — 앱 아이콘 원본을 RGBA 로
{ const png = PNG.sync.read(readFileSync(join(ROOT, 'www', 'public', 'icons', 'icon-512.png'))); writeFileSync(join(OUT, 'icon_512.png'), PNG.sync.write(png, { colorType: 6 })); console.log('  icon_512') }
killServer()
console.log(`\n${OUT}`)
