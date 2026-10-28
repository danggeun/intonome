// 바뀐 파일 → 돌릴 검사. 순수 (scripts/affected.mjs 와 테스트 공용)
// 판단을 사람 기억에 두지 않으려고 표로 둔다. 표에 없는 앱 파일은 전부 돌린다(모르면 넓게)

/** e2e 시나리오 이름의 앞부분(정규식 조각)과 그 영역의 파일들 */
const AREAS = [
  { e2e: ['tuner', 'ref drum', 'detect', 'metro\\+tuner', 'perf', 'settings: note names'], bench: true,
    files: [/^www\/src\/core\/pitch\//, /^www\/src\/core\/playing\//, /^www\/src\/core\/(trace|hzReadout|note|hist)\.ts$/, /^www\/src\/audio\/analysis(\.worker)?\.ts$/, /^www\/src\/ui\/tuner\.ts$/] },
  { e2e: ['drone', 'Play A'], bench: true,
    files: [/^www\/src\/core\/drone\.ts$/, /^www\/src\/audio\/refTone\.ts$/, /^www\/src\/ui\/(drone|refPanel)\.ts$/] },
  { e2e: ['metro', 'layout', 'drag ticks', 'keys'],
    files: [/^www\/src\/core\/metro\//, /^www\/src\/audio\/(metronome|metro\.worklet)\.ts$/, /^www\/src\/ui\/(metro|dial|swipeStep|dragTick)\.ts$/] },
  { e2e: ['rec', 'recording', 'playback', 'editor', 'ux'],
    files: [/^www\/src\/audio\/recorder\.ts$/, /^www\/src\/persist\/recordingsDb\.ts$/, /^www\/src\/ui\/(recList|recHeader)\.ts$/, /^www\/src\/core\/(recPolicy|container|wav|peaks)\.ts$/] },
  { e2e: ['editor', 'ux', 'playback', 'keys'],
    files: [/^www\/src\/ui\/editor\.ts$/, /^www\/src\/audio\/(playback|editorPlayer)\.ts$/, /^www\/src\/core\/(playbackGain|softclip|editRange)\.ts$/] },
  { e2e: ['first-run'], files: [/^www\/src\/(ui|persist)\/tour\.ts$/, /^www\/src\/core\/(tourPlace|metro\/card)\.ts$/] },
  { e2e: ['settings', 'theme', 'first launch', 'i18n', 'first-run'], files: [/^www\/src\/state\//, /^www\/src\/persist\/(settings|legacy)\.ts$/] },
  { e2e: ['i18n', 'first launch', 'settings: note names'], shots: true, files: [/^www\/src\/core\/i18n\//, /^www\/src\/ui\/lang\.ts$/] },
  { e2e: ['theme'], shots: true, files: [/^www\/src\/ui\/theme\.ts$/] },
  { e2e: ['ux: edge swipe', 'keys', 'settings', 'rec:'], shots: true, files: [/^www\/src\/ui\/(menu|settings|swipeBack)\.ts$/] },
  { e2e: ['timer'], files: [/^www\/src\/ui\/timer\.ts$/] },
  { e2e: ['permission', 'i18n: English mic popup', 'metro: works without mic'], files: [/^www\/src\/ui\/micPopup\.ts$/] },
  { e2e: ['launch'], files: [/^www\/src\/ui\/launch\.ts$/] },
  { e2e: ['ref drum', 'drag ticks'], files: [/^www\/src\/ui\/refDrum\.ts$/] },
  { e2e: ['lifecycle', 'mic off', 'ios'], files: [/^www\/src\/core\/micLease\.ts$/] },
  { e2e: ['layout', 'theme', 'i18n', 'metro', 'timer', 'ux'], shots: true, files: [/^www\/index\.html$/, /^www\/src\/style\.css$/, /^www\/src\/fonts/] },
]
/** 여기 걸리면 e2e 전부(+ 스크린샷): 앱 전체가 기대는 곳 */
const ALL = [/^www\/src\/main\.ts$/, /^www\/src\/audio\/(engine|capture\.worklet|messages)\.ts$/, /^www\/src\/platform\//, /^www\/src\/ui\/(dom|toast)\.ts$/, /^www\/src\/core\/notice\.ts$/, /^scripts\/e2e\.mjs$/, /^vite\.config\.js$/, /^package(-lock)?\.json$/, /^tsconfig\.json$/, /^www\/public\//]
/** 앱 동작과 무관 */
const NONE = [/\.md$/, /^docs\//, /^\.github\//, /^LICENSE$/, /^test-assets\/(bench|trace)\//, /^resources\//]

/**
 * @param {string[]} files 저장소 기준 경로(슬래시)
 * @returns {{ unit: 'all' | string[], e2e: 'all' | 'none' | string, bench: boolean, shots: boolean }}
 */
export function plan(files) {
  const p = files.map(f => f.split('\\').join('/'))
  const unitAll = p.some(f => /^(vite\.config\.js|package(-lock)?\.json|tsconfig\.json)$/.test(f))
  const unit = unitAll ? 'all' : p.filter(f => /^(www\/src\/.*\.ts|scripts\/(.*\.test|lib\/.*)\.mjs)$/.test(f)) // vitest related 가 이 파일들을 import 하는 테스트를 찾는다
  let e2eAll = false, bench = false, shots = false
  const parts = new Set()
  for (const f of p) {
    if (NONE.some(r => r.test(f))) continue
    if (/\.test\.(ts|mjs)$/.test(f)) continue // 테스트만 바뀌면 그 테스트만
    if (/^scripts\/(bench\.mjs|gen-signals\.mjs|lib\/(adapter-v[12]|metrics)\.mjs)$/.test(f)) { bench = true; continue }
    if (/^scripts\/screenshots\.mjs$/.test(f) || /^test-assets\/screens\//.test(f)) { shots = true; continue }
    if (ALL.some(r => r.test(f))) { e2eAll = true; shots = true; continue }
    if (/^scripts\//.test(f)) continue // 그 밖의 도구 스크립트는 자기 테스트(unit)로
    const hits = AREAS.filter(a => a.files.some(r => r.test(f)))
    if (!hits.length) { if (/^www\//.test(f)) { e2eAll = true; shots = true } continue }
    for (const a of hits) { a.e2e.forEach(x => parts.add(x)); if (a.bench) bench = true; if (a.shots) shots = true }
  }
  const e2e = e2eAll ? 'all' : parts.size ? `^(${[...parts].sort().join('|')})` : 'none'
  return { unit, e2e, bench, shots }
}
