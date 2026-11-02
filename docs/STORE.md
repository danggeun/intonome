# Store listing

Values to paste into the Play Console, in the order the console asks for them. Edit them here and copy them over; this file is the source, not the console. `scripts/store.test.mjs` checks the lengths and that the URLs match the app.
There is a Korean listing and an English one. **English is the default language**: Play shows the default listing to everyone whose device language has no translation (Japanese, German, …), so the default must be the one more people can read. Korean users still see the Korean listing.

## App details (Dashboard › App details)

| Field | Value |
|---|---|
| App name | see below (per language) |
| Default language | English (en-US); add Korean (ko-KR) |
| App or game | App |
| Free or paid | Free |
| Category | Music & Audio |
| Tags | Tuner, Metronome, Music practice (pick from the console's list) |
| Contact email | `intonome.app@gmail.com` (shown publicly on the listing) |
| Website | https://danggeun.github.io/intonome/ |
| Privacy policy | https://github.com/danggeun/intonome/blob/main/PRIVACY.md |

## App name (30 characters)

```
Intonome: 튜너·메트로놈
```

```
Intonome: Tuner & Metronome
```

## Short description (80 characters)

The 80 characters that search indexes and that show before "More". Instrument names are what people search for; the one thing other tuners do not have (the pitch trace) is named; the tagline stays on the feature graphic.

```
바이올린·비올라·첼로·콘트라베이스 튜너+메트로놈. 비브라토가 보이는 튜너, 드론, 녹음. 광고 없음·오프라인.
```

```
Tuner & metronome for strings that shows your vibrato. Drone, recorder. No ads.
```

## Full description (Korean)

```
바이올린·비올라·첼로·콘트라베이스 연습을 위한 튜너와 메트로놈입니다. 광고도 계정도 없고, 인터넷 없이 전 기능이 동작합니다.
튜너와 메트로놈이 한 화면에 있고, 드론을 켜 두고 음정을 잡거나 연습을 녹음해 바로 들어볼 수 있습니다.

■ 튜너
· 콘트라베이스 E1(40Hz)부터 바이올린 고음까지
· 기준음 A = 410–466Hz (바로크 415 포함)
· 허용 오차 ±5·±10·±15 센트 조절
· 음이름 도레미 / C D E, 이명동음 함께 표시
· 최근 음정이 어떻게 흔들렸는지 화면에 남습니다
· 드론이나 A 듣기가 울려도 앱 소리에는 반응하지 않고 연주하는 음만 읽습니다

■ 메트로놈
· 2/4 · 3/4 · 4/4 · 6/8, 셋잇단 포함 세분 4종
· BPM 40–200, 재생 중에 바꿔도 끊기지 않습니다
· 켜 두는 동안 화면이 꺼지지 않습니다
· 녹음 중에는 클릭이 무음이 되고 화면으로만 박을 보여줍니다

■ A 듣기와 드론
· A 듣기: 악기에 맞는 높이 (바이올린·비올라 A4, 첼로 A3, 콘트라베이스 A2)
· 드론: 12음 중 하나를 계속 울려 두고 그 위에서 음정을 맞춥니다

■ 녹음과 편집
· 구간 반복(A-B), 구간 확대, 북마크
· 0.5–1.5배속 (음높이는 그대로)
· 원하는 구간만 잘라서 WAV 로 저장·공유

■ 연습 타이머
· 켜 둔 시간이 아니라 실제로 소리 낸 시간을 잽니다
· 잡음은 빼고, 악기 소리가 난 시간만 셉니다

■ 개인정보
· 마이크 입력과 녹음은 기기에서만 처리·저장됩니다
· 서버로 아무것도 보내지 않습니다
· 광고 없음, 추적 없음, 계정 없음
· 인터넷 없이도 전 기능이 동작합니다
```

## Full description (English)

```
A tuner and metronome for violin, viola, cello and double bass. No ads, no account, and everything works offline.
The tuner and metronome share one screen. Practice your intonation over a drone, or record yourself and listen back right away.

■ Tuner
· From double bass E1 (40 Hz) to the top of the violin
· Reference A = 410–466 Hz (including Baroque 415)
· Tolerance of ±5, ±10 or ±15 cents
· Letter note names with enharmonics
· A trace shows how your pitch moved over the last few seconds
· Ignores its own drone and Play A and keeps reading you

■ Metronome
· 2/4 · 3/4 · 4/4 · 6/8, four subdivisions including triplets
· 40–200 BPM, change it while playing without a hiccup
· Keeps the screen on while it plays
· Clicks go silent while recording; beats stay on screen

■ Play A and drone
· Play A in your instrument's octave (A4 violin and viola, A3 cello, A2 double bass)
· Hold any of the 12 notes as a drone and tune your intervals against it

■ Recording and editing
· A-B loop, zoom, bookmarks
· 0.5–1.5× speed (pitch unchanged)
· Save or share just the section you want as WAV

■ Practice timer
· Counts the time you actually played, not the time the app was open
· Counts the time an instrument is sounding; noise doesn't count

■ Privacy
· Mic input and recordings are processed and stored only on your device
· Nothing is sent to a server
· No ads, no tracking, no account
· Everything works without an internet connection
```

## Graphics

`npm run store:assets` writes everything to `test-assets/store/` (not committed; takes a few minutes, drives the real app with synthesized playing):

| Asset | File(s) | Play requirement |
|---|---|---|
| App icon | `icon_512.png` | 512 × 512, 32-bit PNG with alpha, ≤ 1 MB |
| Feature graphic | `ko_feature_1024x500.png` / `en_feature_1024x500.png` | 1024 × 500 PNG or JPEG, no alpha. Required, though phones only show it when there is a promo video |
| Phone screenshots | `ko_1_tuner` … `ko_5_light`, `en_…` (1080 × 2160) | 2–8 per listing, 320–3840 px, longer side ≤ 2 × shorter, PNG/JPEG without alpha |
| 7-inch / 10-inch tablet screenshots | not provided | optional; without them the listing just isn't featured on tablets |

Upload in this order; the first two and a half are what a phone shows under the Install button. Each image is a caption plus the app in a phone frame. The captions say only what the picture cannot (edit them in `scripts/store-assets.mjs`, `CAPTIONS`):

| # | Scene | Korean | English |
|---|---|---|---|
| 1 | Tuner, A with the vibrato trace (A = 442 in the Korean set, 440 in English) | 비브라토가 보이는 튜너 / 현악기 튜너 · 메트로놈 | Tuner that shows vibrato / Tuner & metronome for strings |
| 2 | Tuner + metronome, a steady A (no vibrato), 4/4 with eighths running | 튜너와 메트로놈을 한 화면에 / 메트로놈 켜 둔 채 음정 확인 | Tuner and metronome / Check pitch with the click running |
| 3 | Full-size metronome at 96, frozen on the downbeat | 메트로놈만 크게 / 2/4~6/8 · 셋잇단 · 템포 ±5 | Metronome, full size / 2/4–6/8 · triplets · ±5 BPM |
| 4 | Drone C on, G (the fifth) held in tune | 드론 켜 놓고 음정 잡기 / 드론 소리는 빼고 연주하는 음만 읽어요 | Play against a drone / It hears you, not the drone |
| 5 | Light theme | 라이트 테마도 / 광고 없음 · 오프라인 · 무료 | Light theme too / No ads · Offline · Free |

Recording, editor and timer are described in the text but not pictured: list screens do not sell, and five images read in one swipe. The screenshot baselines in `test-assets/screens/baseline/` (780 × 1688) are for visual checks and do not meet the 2:1 rule.

## Privacy policy URL

```
https://github.com/danggeun/intonome/blob/main/PRIVACY.md
```

**Required for Play review.** The app uses the microphone permission and is rejected without it. The same link is in the app (Settings › Privacy policy), which the User Data policy also requires for apps with sensitive permissions. GitHub renders the Markdown, so this URL works as is (the repository must be public). A separate page on Pages would split the source in two, so keep a single file.

## App content (Policy › App content) — answers

| Declaration | Answer | Why |
|---|---|---|
| Privacy policy | the URL above | — |
| Ads | **No**, the app contains no ads | no ad SDK, nothing promoted |
| App access | **All functionality is available without special access** | no login, no account |
| Content rating (IARC) | Category **Utility, Productivity, Communication, or Other**; answer **No** to every question (violence, sexuality, language, controlled substances, gambling, user interaction/sharing location/personal info, digital purchases) | the app has none of these. Expected rating: Everyone / 3+ |
| Target audience and content | Age groups **13–15, 16–17, 18 and over**; "Does your app unintentionally appeal to children?" → **No** | not designed for children (plain tool UI, no characters or games). Selecting under 13 puts the app under the Families policy, which it is not built for |
| News app | No | — |
| COVID-19 contact tracing / status | No | — |
| Data safety | **Does your app collect or share any of the required user data types? → No** | Mic input is analysed on the device and discarded; recordings are stored only on the device (IndexedDB) and never transmitted. Play's definition of "collect" is sending data off the device; on-device-only processing is exempt. "Share" (Download/Share button) is a user-initiated action the user expects, which Play exempts as well (double-check the console's current wording when filling the form). Nothing is encrypted in transit because nothing is transmitted; users delete recordings in the app |
| Advertising ID | **No**, the app does not use the advertising ID | no ads or analytics SDK; Capacitor adds no `AD_ID` permission |
| Government app | No | — |
| Financial features | No financial features | — |
| Health | No health features | a practice tool, not a health app |

The console's separate "Permissions declaration" / sensitive-permission forms cover things like SMS, call log, background location, all-files access, accessibility services, foreground service types and QUERY_ALL_PACKAGES; the microphone is not among them (verify in the console when the app content section is filled in). If anything does ask about the microphone, describe it as: *processed on device only, not stored unless the user taps record; recordings never leave the device unless the user shares them.*

## Release

- **Build**: `npm run keygen` once (upload key `intonome-upload.jks` + `keystore.properties`, both outside git — back them up), then `npm run aab` → `android/app/build/outputs/bundle/release/app-release.aab`. versionCode is `major*10000 + minor*100 + patch` (2.7.0 → 20700), set by `scripts/cap-manifest.mjs`; it must grow with every upload.
- **Play App Signing**: on (mandatory for AAB). The key we make is the *upload* key; Google holds the app signing key. If the upload key is ever lost, request an upload-key reset in the console.
- **Target / min API**: Capacitor 8 template targets API 36 (Android 16), min API 24 (Android 7.0). Play requires new apps to target 36 from 31 Aug 2026.
- **Personal developer accounts (created after 13 Nov 2023)**: a closed test with **at least 12 testers opted in continuously for 14 days** must run before applying for production. Create a Closed testing track, add testers by email list (or a Google Group), share the opt-in link, upload the AAB there first. After 14 days, Dashboard › "Apply for production" (three short sections: the test, the app, readiness; review ≤ 7 days usually).
- **Phones that have the debug APK installed** must uninstall it before installing the Play version (different signing key). Export recordings first (Download/Share) — uninstalling deletes them.
- **Release notes** (what's new, ≤ 500 characters per language): take the top lines of the CHANGELOG entry.
