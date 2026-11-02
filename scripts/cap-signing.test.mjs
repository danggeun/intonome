import { describe, test, expect } from 'vitest'
import { withSigning, checkKeystoreProps, MARK } from './cap-signing.mjs'

// Capacitor 8 템플릿 app/build.gradle 의 android{} 부분 그대로
const TEMPLATE = `apply plugin: 'com.android.application'

android {
    namespace = "com.getcapacitor.myapp"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.getcapacitor.app"
        versionCode 1
        versionName "1.0"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
`

describe('withSigning', () => {
  test('adds a signingConfigs block before buildTypes and signs the release build type with it', () => {
    const out = withSigning(TEMPLATE)
    expect(out.indexOf('signingConfigs {')).toBeLessThan(out.indexOf('buildTypes {'))
    expect(out).toMatch(/release \{\n\s+minifyEnabled false\n\s+proguardFiles[^\n]*\n\s+if \(keystorePropertiesFile\.exists\(\)\) signingConfig signingConfigs\.release[^\n]*\n\s+\}/)
    expect(out).toContain("rootProject.file('../keystore.properties')")
    expect(out).toContain("rootProject.file('../' + keystoreProperties['storeFile'])")
  })
  test('idempotent', () => { const once = withSigning(TEMPLATE); expect(withSigning(once)).toBe(once) })
  test('without keystore.properties the config stays empty (gradle still builds, unsigned release)', () => {
    expect(withSigning(TEMPLATE)).toContain('if (keystorePropertiesFile.exists()) {')
  })
  test('refuses a gradle file it does not understand', () => expect(() => withSigning('android {}')).toThrow(/buildTypes/))
  test('the marker is a comment', () => expect(MARK.startsWith('//')).toBe(true))
})

describe('checkKeystoreProps', () => {
  const good = 'storeFile=intonome-upload.jks\nstorePassword=pw\nkeyAlias=intonome\nkeyPassword=pw\n'
  test('complete and the key file exists', () => expect(checkKeystoreProps(good, () => true)).toMatchObject({ ok: true, props: { keyAlias: 'intonome' } }))
  test('a missing field is named', () => expect(checkKeystoreProps('storeFile=a.jks\nstorePassword=pw\n')).toMatchObject({ ok: false, why: expect.stringContaining('keyAlias') }))
  test('a missing key file is named', () => expect(checkKeystoreProps(good, () => false)).toMatchObject({ ok: false, why: expect.stringContaining('intonome-upload.jks') }))
  test('comments and Windows line ends are fine; = in a password is kept; like java.util.Properties, a trailing space is part of the value', () => {
    expect(checkKeystoreProps('# upload key\r\nstoreFile=k.jks\r\nstorePassword=a=b\r\nkeyAlias=x\r\nkeyPassword=c \r\n', () => true)).toMatchObject({ ok: true, props: { storePassword: 'a=b', keyPassword: 'c ' } })
  })
})

describe('keygen password rule (what java.util.Properties can carry unchanged)', async () => {
  const { passwordProblem } = await import('./keygen.mjs')
  test('ASCII letters, digits and symbols pass', () => expect(passwordProblem('Str0ng!Pass#2026')).toBe(null))
  test('short, spaces, Korean and backslashes are refused with a reason', () => {
    expect(passwordProblem('abc')).toMatch(/6/); expect(passwordProblem('has space1')).toBeTruthy(); expect(passwordProblem('비밀번호123')).toBeTruthy(); expect(passwordProblem('a\\b123456')).toBeTruthy()
  })
})
