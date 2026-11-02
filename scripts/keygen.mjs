#!/usr/bin/env node
// 스토어 업로드 키 만들기 — 저장소 루트에 intonome-upload.jks + keystore.properties (둘 다 git 에 안 들어간다).
// 사용: npm run keygen  → 비밀번호 두 번(화면에 안 보임) → 끝. 한 번 만들면 다시 만들지 않는다(Play 는 같은 업로드 키만 받는다)
import { existsSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const JKS = 'intonome-upload.jks', ALIAS = 'intonome', PROPS = 'keystore.properties'

/** keytool 찾기 — PATH → JAVA_HOME → Android Studio 에 딸린 JDK(jbr) */
export function findKeytool(env = process.env, platform = process.platform, exists = existsSync) {
  const exe = platform === 'win32' ? 'keytool.exe' : 'keytool'
  const cands = []
  if (env.JAVA_HOME) cands.push(join(env.JAVA_HOME, 'bin', exe))
  if (platform === 'win32') {
    for (const base of [env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Programs', 'Android Studio'), 'C:\\Program Files\\Android\\Android Studio']) if (base) cands.push(join(base, 'jbr', 'bin', exe))
  } else if (platform === 'darwin') cands.push('/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool')
  else cands.push('/opt/android-studio/jbr/bin/keytool', '/usr/lib/jvm/default-java/bin/keytool')
  const onPath = spawnSync(exe, ['-help'], { stdio: 'ignore' }) // 셸 없이 — Windows 도 PATH 의 .exe 를 찾는다
  if (!onPath.error) return exe
  return cands.find(c => exists(c)) ?? null
}

/** keystore.properties 는 gradle 이 java.util.Properties 로 읽는다 — 역슬래시는 이스케이프, 앞뒤 공백은 잘리고, 라틴 문자 밖은 깨진다. 그 범위 밖이면 이유를 돌려준다 */
export function passwordProblem(pw) {
  if (pw.length < 6) return '6자 이상이어야 합니다.'
  if (!/^[\x21-\x7e]+$/.test(pw)) return '영문·숫자·기호만, 공백 없이 (한글·공백은 빌드 설정 파일에서 깨집니다).'
  if (pw.includes('\\')) return '역슬래시(\\)는 쓸 수 없습니다.'
  return null
}

/** 비밀번호를 화면에 안 보이게 읽는다(터미널). 파이프로 들어오면 그냥 한 줄 읽는다 */
let lines = null
function askHidden(question) {
  process.stdout.write(question)
  if (!process.stdin.isTTY) {
    if (!lines) lines = createInterface({ input: process.stdin })[Symbol.asyncIterator]()
    return lines.next().then(r => { process.stdout.write('\n'); return r.done ? '' : r.value })
  }
  return new Promise(res => {
    const muted = new Writable({ write(_c, _e, cb) { cb() } })
    const rl = createInterface({ input: process.stdin, output: muted, terminal: true })
    rl.question('', a => { rl.close(); process.stdout.write('\n'); res(a) })
  })
}

async function main() {
  if (existsSync(join(ROOT, JKS))) { console.error(`${JKS} 가 이미 있습니다. 업로드 키는 하나만 씁니다 — 잃어버린 게 아니면 다시 만들지 마세요.`); process.exit(1) }
  const keytool = findKeytool()
  if (!keytool) { console.error('keytool 을 찾지 못했습니다. Android Studio 가 깔려 있으면 JAVA_HOME 을 그 jbr 폴더로 두고 다시 실행하세요 (예: C:\\Program Files\\Android\\Android Studio\\jbr).'); process.exit(1) }
  console.log(`keytool: ${keytool}`)
  let pw
  for (;;) {
    pw = await askHidden('키 비밀번호 (6자 이상, 영문·숫자·기호, 잊으면 앱 업데이트를 못 올립니다): ')
    const bad = passwordProblem(pw); if (bad) { console.log(bad); continue }
    const again = await askHidden('한 번 더: ')
    if (pw === again) break
    console.log('두 입력이 다릅니다.')
  }
  const r = spawnSync(keytool, ['-genkeypair', '-v', '-keystore', JKS, '-alias', ALIAS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', pw, '-keypass', pw, '-dname', 'CN=Intonome, O=Intonome, C=KR'], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] }) // 셸 없이 — 비밀번호에 특수문자가 있어도 그대로 전달된다
  if (r.status !== 0) { console.error('keytool 실패'); process.exit(r.status ?? 1) }
  writeFileSync(join(ROOT, PROPS), `storeFile=${JKS}\nstorePassword=${pw}\nkeyAlias=${ALIAS}\nkeyPassword=${pw}\n`)
  console.log(`\n만들었습니다: ${JKS} · ${PROPS} (둘 다 git 밖)\n이 두 파일을 지금 안전한 곳(클라우드 드라이브·USB)에 복사해 두세요. 키를 잃으면 같은 앱으로 업데이트를 올릴 수 없습니다.\n다음: npm run aab`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
