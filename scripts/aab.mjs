#!/usr/bin/env node
// 스토어용 Android App Bundle — 웹 빌드 → cap sync(매니페스트·버전·서명 보정) → gradle bundleRelease. 결과: android/app/build/outputs/bundle/release/app-release.aab
// 사용: npm run aab   (먼저 npm run keygen 으로 키가 있어야 한다)
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { checkKeystoreProps } from './cap-signing.mjs'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const win = process.platform === 'win32'
const run = (cmd, args, cwd = ROOT) => { const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win }); if (r.status !== 0) process.exit(r.status ?? 1) }

if (!existsSync(join(ROOT, 'android'))) { console.error('android/ 없음 — 먼저 `npx cap add android`'); process.exit(1) }
const props = join(ROOT, 'keystore.properties')
if (!existsSync(props)) { console.error('keystore.properties 없음 — 먼저 `npm run keygen`'); process.exit(1) }
const k = checkKeystoreProps(readFileSync(props, 'utf8'), f => existsSync(isAbsolute(f) ? f : join(ROOT, f)))
if (!k.ok) { console.error(k.why); process.exit(1) }

run('npm', ['run', 'cap:sync']) // build:cap → cap sync → cap-manifest(권한·세로·버전) → cap-signing
run(win ? 'gradlew.bat' : './gradlew', ['bundleRelease'], join(ROOT, 'android'))

const out = join(ROOT, 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
if (!existsSync(out)) { console.error('AAB 가 만들어지지 않았습니다: ' + out); process.exit(1) }
const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const [a, b, c] = version.split('.').map(Number)
console.log(`\nAAB: ${out}\n${(statSync(out).size / 1024 / 1024).toFixed(1)} MB · versionName ${version} · versionCode ${a * 10000 + b * 100 + c}\n이 파일을 Play Console 에 올립니다 (업로드 키로 서명됨 — Play 앱 서명이 배포 키로 다시 서명한다).`)
