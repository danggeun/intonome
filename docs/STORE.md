# Store listing

Values to paste into the Play Console, in the order the console asks for them. Edit them here and copy them over; this file is the source, not the console. `scripts/store.test.mjs` checks the lengths and that the URLs match the app.
There are English, Korean, Japanese, Simplified Chinese, Traditional Chinese and Spanish listings. **English is the default language**: Play shows the default listing to everyone whose device language has no translation (German, …), so the default must be the one more people can read. Korean, Japanese, Chinese (Simplified: mainland, Singapore, Malaysia; Traditional: Taiwan, Hong Kong, Macau) and Spanish-speaking users see their own listing. The Spanish listing is one neutral text registered as es-419 (Latin America) and es-ES.

## App details (Dashboard › App details)

| Field | Value |
|---|---|
| App name | see below (per language) |
| Default language | English (en-US); add Korean (ko-KR), Japanese (ja-JP), Simplified Chinese (zh-CN), Traditional Chinese (zh-TW), Spanish (es-419 and es-ES, same text) |
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

```
Intonome: チューナー＆メトロノーム
```

```
Intonome：调音器与节拍器
```

```
Intonome：調音器與節拍器
```

```
Intonome: Afinador y metrónomo
```

## Short description (80 characters)

The 80 characters that search indexes and that show before "More". Instrument names are what people search for; the one thing other tuners do not have (the pitch trace) is named; the tagline stays on the feature graphic.

```
바이올린·비올라·첼로·콘트라베이스 튜너+메트로놈. 비브라토가 보이는 튜너, 드론, 녹음. 광고 없음·오프라인.
```

```
Tuner & metronome for strings that shows your vibrato. Drone, recorder. No ads.
```

```
バイオリン・ビオラ・チェロ・コントラバスのチューナー＋メトロノーム。ビブラートが見えるチューナー、ドローン、録音。広告なし・オフライン
```

```
小提琴、中提琴、大提琴、低音提琴的调音器与节拍器。能看见揉弦的调音器、持续音、录音。无广告，可离线使用
```

```
小提琴、中提琴、大提琴、低音提琴的調音器與節拍器。看得見揉弦（vibrato）的調音器、持續音、錄音。無廣告，可離線使用
```

```
Afinador y metrónomo para violín, viola y chelo. Ve tu vibrato. Sin anuncios
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

## Full description (Japanese)

```
バイオリン・ビオラ・チェロ・コントラバスの練習のためのチューナーとメトロノームです。広告もアカウントもなく、インターネットなしで全機能が使えます。
チューナーとメトロノームが同じ画面にあり、ドローンを鳴らしたまま音程を合わせたり、練習を録音してすぐ聴き返したりできます。

■ チューナー
· コントラバスの E1 (40Hz) からバイオリンの高音まで
· 基準音 A = 410〜466Hz (バロックの 415 を含む)
· 許容範囲は ±5・±10・±15 セント
· 音名はドレミ / C D E、異名同音も表示
· ここ数秒の音程の動きが線で画面に残ります
· ドローンや A の音が鳴っていてもアプリの音には反応せず、演奏している音だけを読みます

■ メトロノーム
· 2/4 · 3/4 · 4/4 · 6/8、3連符を含む4種類の分割
· 40〜200 BPM、再生中に変えても途切れません
· 鳴らしている間は画面が消えません
· 録音中はクリックが無音になり、拍は画面にだけ表示されます

■ A の音とドローン
· A の音: 楽器に合った高さ (バイオリン・ビオラは A4、チェロは A3、コントラバスは A2)
· ドローン: 12 の音のどれかを鳴らし続け、その上で音程を合わせます

■ 録音と編集
· 区間リピート (A-B)、区間の拡大、ブックマーク
· 0.5〜1.5倍速 (音の高さはそのまま)
· 必要な区間だけを切り出して WAV で保存・共有

■ 練習タイマー
· アプリを開いていた時間ではなく、実際に音を出した時間を計ります
· 雑音は除き、楽器の音が鳴っていた時間だけを数えます

■ プライバシー
· マイク入力と録音は端末の中だけで処理・保存されます
· サーバーには何も送りません
· 広告なし、トラッキングなし、アカウントなし
· インターネットがなくても全機能が使えます
```

## Full description (Chinese, Simplified)

```
为小提琴、中提琴、大提琴和低音提琴练习设计的调音器与节拍器。没有广告，不需要账户，没有网络也能使用全部功能。
调音器和节拍器在同一个界面上。可以开着持续音练音准，也可以把练习录下来马上回听。

■ 调音器
· 从低音提琴的 E1（40 Hz）到小提琴的高音区
· 标准音 A = 410–466 Hz（包括巴洛克的 415）
· 允许误差 ±5、±10、±15 音分
· 音名 C D E，并显示等音（如 A♯/B♭）
· 最近几秒的音高变化会以一条线留在屏幕上
· 持续音或 A 音响着的时候，也只识别你演奏的音，不受应用自身声音的影响

■ 节拍器
· 2/4 · 3/4 · 4/4 · 6/8，四种细分，包括三连音
· 40–200 BPM，播放中改速度也不会卡顿
· 播放时屏幕保持常亮
· 录音时节拍声静音，只在屏幕上显示拍子

■ A 音与持续音
· A 音：按乐器选八度（小提琴、中提琴 A4，大提琴 A3，低音提琴 A2）
· 持续音：让 12 个音中的任意一个一直响，伴着它练音准

■ 录音与编辑
· A-B 循环、区间放大、书签
· 0.5–1.5 倍速（音高不变）
· 只截取想要的片段，保存或分享为 WAV

■ 练习计时
· 记录的是真正发出声音的时间，而不是打开应用的时间
· 排除噪音，只计算乐器发声的时间

■ 隐私
· 麦克风输入和录音只在你的设备上处理和保存
· 不向任何服务器发送数据
· 无广告，无跟踪，无账户
· 没有网络也能使用全部功能
```

## Full description (Chinese, Traditional)

```
為小提琴、中提琴、大提琴和低音提琴練習設計的調音器與節拍器。沒有廣告，不需要帳號，沒有網路也能使用全部功能。
調音器和節拍器在同一個畫面上。可以開著持續音練音準，也可以把練習錄下來馬上重聽。

■ 調音器
· 從低音提琴的 E1（40 Hz）到小提琴的高音區
· 標準音 A = 410–466 Hz（包括巴洛克的 415）
· 容許誤差 ±5、±10、±15 音分
· 音名 C D E，並顯示等音（如 A♯/B♭）
· 最近幾秒的音高變化會以一條線留在螢幕上
· 持續音或 A 音響著的時候，也只辨識你演奏的音，不受 App 自身聲音的影響

■ 節拍器
· 2/4 · 3/4 · 4/4 · 6/8，四種細分，包括三連音
· 40–200 BPM，播放中改速度也不會中斷
· 播放時螢幕保持常亮
· 錄音時節拍聲靜音，只在螢幕上顯示拍子

■ A 音與持續音
· A 音：按樂器選八度（小提琴、中提琴 A4，大提琴 A3，低音提琴 A2）
· 持續音：讓 12 個音中的任意一個一直響，伴著它練音準

■ 錄音與編輯
· A-B 循環、區間放大、書籤
· 0.5–1.5 倍速（音高不變）
· 只擷取想要的片段，儲存或分享為 WAV

■ 練習計時
· 記錄的是真正發出聲音的時間，而不是開啟 App 的時間
· 排除噪音，只計算樂器發聲的時間

■ 隱私
· 麥克風輸入和錄音只在你的裝置上處理和儲存
· 不向任何伺服器傳送資料
· 無廣告，無追蹤，無帳號
· 沒有網路也能使用全部功能
```

## Full description (Spanish)

```
Afinador y metrónomo para practicar violín, viola, violonchelo y contrabajo. Sin anuncios, sin cuenta y todo funciona sin conexión.
El afinador y el metrónomo comparten una sola pantalla. Practica tu afinación sobre una nota pedal, o grábate y escúchate al momento.

■ Afinador
· Desde el Mi1 del contrabajo (40 Hz) hasta lo más agudo del violín
· La de referencia = 410–466 Hz (incluido el 415 barroco)
· Tolerancia de ±5, ±10 o ±15 cents
· Nombres de nota Do Re Mi o C D E, con enarmónicos
· Una línea muestra cómo se movió tu afinación en los últimos segundos
· Ignora su propia nota pedal y el La de referencia y sigue leyéndote a ti

■ Metrónomo
· 2/4 · 3/4 · 4/4 · 6/8, cuatro subdivisiones, tresillos incluidos
· 40–200 BPM, cámbialo mientras suena sin cortes
· Mantiene la pantalla encendida mientras suena
· Se silencia al grabar; los pulsos siguen en pantalla

■ Oír el La y nota pedal
· El La en la octava de tu instrumento (La4 violín y viola, La3 violonchelo, La2 contrabajo)
· Mantén cualquiera de las 12 notas como nota pedal y afina tus intervalos sobre ella

■ Grabación y edición
· Bucle A-B, zoom, marcadores
· Velocidad 0,5–1,5× (sin cambiar la altura)
· Guarda o comparte solo el fragmento que quieras en WAV

■ Tiempo de práctica
· Cuenta el tiempo que de verdad tocaste, no el tiempo que la app estuvo abierta
· Cuenta el tiempo en que suena un instrumento; el ruido no cuenta

■ Privacidad
· La entrada del micrófono y las grabaciones se procesan y guardan solo en tu dispositivo
· No se envía nada a ningún servidor
· Sin anuncios, sin rastreo, sin cuenta
· Todo funciona sin conexión a internet
```

## Graphics

`npm run store:assets` writes everything to `test-assets/store/` (not committed; takes a few minutes, drives the real app with synthesized playing):

| Asset | File(s) | Play requirement |
|---|---|---|
| App icon | `icon_512.png` | 512 × 512, 32-bit PNG with alpha, ≤ 1 MB |
| Feature graphic | `ko_feature_1024x500.png` / `en_feature_1024x500.png` | 1024 × 500 PNG or JPEG, no alpha. Required, though phones only show it when there is a promo video |
| Phone screenshots | `ko_1_tuner` … `ko_5_light`, `en_…`, `ja_…`, `zh_…` (Simplified), `zht_…` (Traditional), `es_…` (1080 × 2160) | 2–8 per listing, 320–3840 px, longer side ≤ 2 × shorter, PNG/JPEG without alpha |
| 7-inch / 10-inch tablet screenshots | not provided | optional; without them the listing just isn't featured on tablets |

Upload in this order; the first two and a half are what a phone shows under the Install button. Each image is a caption plus the app in a phone frame. The captions say only what the picture cannot (edit them in `scripts/store-assets.mjs`, `CAPTIONS`):

| # | Scene | Korean | English | Japanese | Chinese (Simplified) | Chinese (Traditional) | Spanish |
|---|---|---|---|---|---|---|---|
| 1 | Tuner, A with the vibrato trace (A = 442 in the Korean and Japanese sets, 440 in English and Chinese) | 비브라토가 보이는 튜너 / 현악기 튜너 · 메트로놈 | Tuner that shows vibrato / Tuner & metronome for strings | ビブラートが見えるチューナー / 弦楽器のチューナー・メトロノーム | 能看见揉弦的调音器 / 弦乐调音器 · 节拍器 | 看得見揉弦的調音器 / 弦樂調音器 · 節拍器 | Un afinador que muestra el vibrato / Afinador y metrónomo para cuerdas |
| 2 | Tuner + metronome, a steady A (no vibrato), 4/4 with eighths running | 튜너와 메트로놈을 한 화면에 / 메트로놈 켜 둔 채 음정 확인 | Tuner and metronome / Check pitch with the click running | チューナーとメトロノームを1画面に / メトロノームを鳴らしたまま音程を確認 | 调音器和节拍器在同一屏 / 开着节拍器看音准 | 調音器和節拍器在同一個畫面 / 開著節拍器看音準 | Afinador y metrónomo juntos / Mira la afinación con el metrónomo sonando |
| 3 | Full-size metronome at 96, frozen on the downbeat | 메트로놈만 크게 / 2/4~6/8 · 셋잇단 · 템포 ±5 | Metronome, full size / 2/4–6/8 · triplets · ±5 BPM | メトロノームだけを大きく / 2/4〜6/8 · 3連符 · テンポ ±5 | 放大节拍器 / 2/4–6/8 · 三连音 · 速度 ±5 | 放大節拍器 / 2/4–6/8 · 三連音 · 速度 ±5 | Metrónomo a tamaño completo / 2/4–6/8 · tresillos · ±5 BPM |
| 4 | Drone C on, G (the fifth) held in tune | 드론 켜 놓고 음정 잡기 / 드론 소리는 빼고 연주하는 음만 읽어요 | Play against a drone / It hears you, not the drone | ドローンを鳴らして音程合わせ / ドローンの音は拾わず、演奏した音だけを読みます | 开着持续音练音准 / 只听你的音，不听持续音 | 開著持續音練音準 / 只聽你的音，不聽持續音 | Toca sobre una nota pedal / Te escucha a ti, no a la nota pedal |
| 5 | Light theme | 라이트 테마도 / 광고 없음 · 오프라인 · 무료 | Light theme too / No ads · Offline · Free | ライトテーマも / 広告なし · オフライン · 無料 | 也有浅色主题 / 无广告 · 离线 · 免费 | 也有淺色主題 / 無廣告 · 離線 · 免費 | También en tema claro / Sin anuncios · Sin conexión · Gratis |

Recording, editor and timer are described in the text but not pictured: list screens do not sell, and five images read in one swipe. The screenshot baselines in `test-assets/screens/baseline/` (780 × 1688) are for visual checks and do not meet the 2:1 rule.

## Privacy policy URL

```
https://github.com/danggeun/intonome/blob/main/PRIVACY.md
```

**Required for Play review.** The app uses the microphone permission and is rejected without it. The same text is shown inside the app (Settings › Privacy policy, built from this file at build time), which the User Data policy also requires for apps with sensitive permissions. GitHub renders the Markdown, so this URL works as is (the repository must be public). A separate page on Pages would split the source in two, so keep a single file.

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
