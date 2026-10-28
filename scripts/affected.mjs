#!/usr/bin/env node
// 바뀐 파일로 돌릴 검사를 정한다 (표: scripts/lib/affected.mjs).
// 사용: node scripts/affected.mjs [기준=origin/main] [--run]
//   기준과 지금(커밋 + 작업 중 + 새 파일)의 차이 → 단위(vitest related) · e2e(--only) · 벤치 · 스크린샷 중 필요한 것만.
//   --run 이면 그대로 실행한다: 타입·경계는 늘, 나머지는 필요한 것만. 실패하면 거기서 멈춘다.
import { execSync, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plan } from './lib/affected.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const base = args.find(a => !a.startsWith('--')) ?? 'origin/main'
const git = c => execSync(`git ${c}`, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
const files = [...new Set([...git(`diff --name-only ${base}...HEAD`), ...git('diff --name-only HEAD'), ...git('ls-files --others --exclude-standard')])].sort()
const p = plan(files)

const unitFiles = p.unit === 'all' ? [] : p.unit.map(f => join(ROOT, f))
const steps = [['typecheck', 'npx tsc --noEmit'], ['boundaries', 'node scripts/check-deps.mjs']]
if (p.unit === 'all') steps.push(['unit (all)', 'npx vitest run'])
else if (unitFiles.length) steps.push(['unit (related)', `npx vitest related --run ${unitFiles.map(f => JSON.stringify(f)).join(' ')}`])
if (p.bench) steps.push(['bench', 'node scripts/gen-signals.mjs && node scripts/bench.mjs > /dev/null && git diff --exit-code --stat test-assets/bench/latest.md'])
if (p.e2e !== 'none') steps.push([`e2e ${p.e2e === 'all' ? '(all)' : p.e2e}`, `npm run build:cap && node scripts/e2e.mjs --dist dist${p.e2e === 'all' ? '' : ` --only ${JSON.stringify(p.e2e)}`}`])
if (p.shots) steps.push(['screenshots', 'npm run shots'])

console.log(`기준 ${base} · 바뀐 파일 ${files.length}개`)
for (const f of files) console.log('  ' + f)
console.log('\n돌릴 검사:')
for (const [name, cmd] of steps) console.log(`  ${name}\n    ${cmd}`)
if (p.bench) console.log('  (벤치: latest.md 가 바뀌면 결과가 달라진 것 — 의도한 변화인지 diff 로 본다)')

if (args.includes('--run')) {
  for (const [name, cmd] of steps) {
    console.log(`\n▶ ${name}`)
    const r = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: 'inherit' })
    if (r.status !== 0) { console.log(`✗ ${name} 실패`); process.exit(r.status ?? 1) }
  }
  console.log('\n✓ 바뀐 범위의 검사 모두 통과')
}
