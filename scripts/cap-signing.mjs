#!/usr/bin/env node
// Android release 서명 — `keystore.properties`(저장소 루트, git 에 안 들어감)가 있으면 app/build.gradle 의 release 빌드가 그 키로 서명되게 한다.
// cap:sync 가 매번 실행한다(멱등). 파일이 없으면 gradle 은 그대로 debug 서명만 쓴다 — 스토어용 AAB 는 `npm run aab` 가 먼저 확인한다
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const MARK = '// intonome release signing (scripts/cap-signing.mjs)'
/** android{} 안, buildTypes 앞에 넣는 블록. 키 파일 경로는 keystore.properties 의 storeFile(저장소 루트 기준) */
const SIGNING_BLOCK = `    ${MARK}
    def keystorePropertiesFile = rootProject.file('../keystore.properties')
    def keystoreProperties = new Properties()
    if (keystorePropertiesFile.exists()) keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                def ksf = new File(keystoreProperties['storeFile'])
                storeFile(ksf.isAbsolute() ? ksf : rootProject.file('../' + keystoreProperties['storeFile']))
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
`
/** build.gradle 에 release 서명을 넣는다. 이미 있으면 그대로. 순수 */
export function withSigning(gradle) {
  if (gradle.includes(MARK)) return gradle
  const bt = gradle.indexOf('    buildTypes {')
  if (bt < 0) throw new Error('app/build.gradle: buildTypes block not found')
  let out = gradle.slice(0, bt) + SIGNING_BLOCK + gradle.slice(bt)
  // release 빌드 타입에 signingConfig 한 줄
  const rel = out.indexOf('        release {', out.indexOf('    buildTypes {'))
  if (rel < 0) throw new Error('app/build.gradle: buildTypes.release not found')
  const close = out.indexOf('        }', rel)
  out = out.slice(0, close) + '            if (keystorePropertiesFile.exists()) signingConfig signingConfigs.release // 없으면 템플릿 그대로(서명 없는 release) — debug 빌드는 영향 없음\n' + out.slice(close)
  return out
}
/** keystore.properties 가 완전한가 — 네 키 전부 · 키 파일이 실제로 있음(storeFile 은 저장소 루트 기준, 절대 경로도 됨). 없으면 이유 */
export function checkKeystoreProps(text, exists = () => true) {
  // java.util.Properties 와 같은 읽기: 키는 trim, 값은 앞 공백만 잘린다(뒤 공백은 값의 일부). 역슬래시 이스케이프는 keygen 이 막는다
  const props = Object.fromEntries(text.split(/\r?\n/).filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).replace(/^\s+/, '')] }))
  for (const k of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) if (!props[k]) return { ok: false, why: `keystore.properties: ${k} missing` }
  if (!exists(props.storeFile)) return { ok: false, why: `keystore.properties: storeFile not found: ${props.storeFile}` }
  return { ok: true, props }
}

export function main(log = console.log) {
  const gradle = join(ROOT, 'android', 'app', 'build.gradle')
  if (!existsSync(gradle)) { log('android/ 없음 — `npx cap add android` 후 다시 실행'); return }
  const src = readFileSync(gradle, 'utf8'), out = withSigning(src)
  if (out !== src) { writeFileSync(gradle, out); log('build.gradle: release signing from keystore.properties') } else log('build.gradle: release signing OK')
  const props = join(ROOT, 'keystore.properties')
  if (!existsSync(props)) { log('keystore.properties 없음 — release 는 서명되지 않는다. 스토어용 키는 `npm run keygen`'); return }
  const r = checkKeystoreProps(readFileSync(props, 'utf8'), f => existsSync(isAbsolute(f) ? f : join(ROOT, f)))
  log(r.ok ? `keystore.properties OK (${r.props.storeFile}, alias ${r.props.keyAlias})` : r.why)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
