# Intonome architecture

## 1. Layers

```
www/src/
  main.ts      Wiring: connects modules, startup sequence, app lifecycle (hide/return, editor, idle watch; what to let go on hide or when the editor opens is decided by core/micLease), service worker, diagnostics hook window.__tt
  ui/          DOM bindings per card: tuner, refDrum, refPanel (Play A), drone, metro, dial, swipeBack, swipeStep, menu, settings, timer,
               micPopup, recHeader, recList, editor, toast, theme, lang, tour (first-run guide). mount*() binds the DOM and subscribes to stores
  audio/       Web Audio adapters: engine (single AudioContext, mic session), analysis (+worker), capture.worklet,
               metronome (+metro.worklet), refTone (Play A and drone), recorder, playback (output route for recordings),
               editorPlayer (what the editor plays through), stretchPlayer (+stretch.worklet), decode, messages
  state/       Stores per domain (settings / tuner / metro / refTone / drone / session / recList). Source of the types
  persist/     Settings and the first-run guide flag in localStorage, recordings in IndexedDB
  platform/    Web / Capacitor branches (status bar, wake lock, full screen, file saving, back button)
  core/        Pure logic, no browser APIs, all unit-tested:
               pitch/(fft, yinFast, spectrum, tracker, readout, analyzer) · playing/detector · metro/(sequencer, arrival, sweep, dial, clickPitch, card)
               i18n/(ko, en), drone, note, wav, peaks, format, recPolicy, hist, trace, hzReadout, softclip, playbackGain, container,
               notice, micLease, editRange, tourPlace, stretch, mono, yin (reference only, not bundled)
```

Dependency rules (`scripts/check-deps.mjs`, part of `npm run check`):

| Layer | May import |
|---|---|
| core | core |
| state | state, core |
| persist | persist, state, core |
| platform | platform, core (on-screen text and the notice channel) |
| audio | audio, core, state, persist, platform |
| ui | ui, core, state, audio (commands only), platform |

`ui` never reads `audio` state directly: `ui → audio (command) → store → ui (subscription)`.
Messages from `audio`, `persist` and `platform` for the user (errors, notices) go through one channel, `core/notice`; `main.ts` connects it to the toast.
Arithmetic that can be tested without a browser lives in `core`: the editor's time window, A–B limits and speed steps (`editRange`), the metronome card's stages and drag rules (`metro/card`), the first-run guide's bubble placement (`tourPlace`) and, for main.ts, the rules for letting go of the mic when the app is hidden or the editor opens (`micLease`). A few UI helpers keep their own tests next to them (`ui/dragTick`, `ui/swipeBack`, `ui/toast`).
No framework. A store is `createStore(initial)` with `get / set / select`. Styles use only the tokens on `:root` in `style.css`.

## 2. Audio pipeline

```
mic ─ getUserMedia ─▶ AudioWorkletNode (capture.worklet)        audio thread
                         │  1024-sample transferable Float32Array over a direct MessagePort
                         ▼
                  Analysis Worker (analysis.worker)             ≈43 Hz
                    app-tone filter (only while Play A or the drone sounds) → ring buffer → 4096 window → FFT-YIN → spectrum (octave correction: the lowest sounding harmonic series, never a second voice above it; a weak fundamental is judged against the note's strongest partial, and a fifth's virtual fundamental is told apart by the holes at its 5th and 7th multiples)
                    → tracker (from silence a note is shown only after 6 consecutive frames within 40 cents of their median, ≈ 0.17 s (7 left fast spiccato scales after a rest unseen); a change is confirmed over 2 frames and the needle never moves towards an unconfirmed far candidate; after a change the needle follows the median unsmoothed until the median window holds only the new note; the last note is held ≈ 0.5 s after the sound stops; no frame is ever blanked for being unlike its neighbours) → playing detector
                    a reference other than 440 is normalized before the tracker and restored for display
                         ▼
                  a change of the reference pitch (A =) shifts the tracker's and the readout's state by the same cents (rebase) so the label, number and Hz are right on the next frame
                  readout: the cents number, the in-tune green and the Hz readout (the pitch that number names, core/hzReadout) come from a 0.37 s triangle-weighted average that changes only when it moves 1.5 cents (core/pitch/readout); frames from a note change until the median window holds only the new note stay out of that average; the trace uses every frame except the window-straddling ones at a change (the last frame of the old note and the first two of the new one, core/trace) and joins the two notes with a short S-curve
                  tunerStore.set(...) → ui/tuner renders only the latest value on rAF
```

- One `AudioContext` (engine.ts). It is suspended when idle (no mic, metronome, Play A, drone or recording playback). Mic sessions are identified by `micGen`.
- Everything the app plays (metronome, Play A, drone) goes through one soft limiter, `output()` in engine.ts.
- Play A and the drone are the same sound (a triangle wave at the same level and fade) and never sound together. The app knows their frequency f exactly, and whatever the phone speaker and the room add to them lands only on whole multiples of f. While one sounds, the worker cuts f and every multiple up to 8 kHz out of the mic signal (a narrow notch at each, as wide in Hz as the one at f) and low-passes at 5 kHz before analysis (`core/drone.ts`, 0.3 s to settle). A window where what is left is under 12 % of what was cut is analyzed as silence, so the tuner shows nothing and the practice timer doesn't count it. A played note whose partials all land on multiples of f (the same note or an octave above, in tune within about 3 cents) is cut with it. So the worker first checks whether the tone reaches the mic at all (`createToneProbe`): it measures the tone's partials at their exact frequencies and phase, and when they stay under a tenth of the sensitivity threshold for four frames (earphones) it analyzes the uncut signal instead. It starts from "heard", so a player sounding the same note when the tone starts only keeps the cut. Once uncut, a component at the tone's partials whose level and phase hold within 1 % for six frames (the tone reaching the mic — a bowed note never holds that still) brings the cut back and clears the display; a `devicechange` (earphones plugged or unplugged) brings it back at once and holds the tuner silent while the notches settle again.
- The sample rate is not forced. No SharedArrayBuffer (COOP/COEP can't be set on Pages or in Capacitor).
- The metronome runs in its own worklet (metro.worklet + core/metro/sequencer). The tempo number is the beat of the time signature (the dotted quarter in 6/8); the volume slider is a square taper applied when the click is rendered. Each click sits exactly between two notes of the current reference pitch (core/metro/clickPitch, near 1800 / 1100 / 750 Hz), so a note played less than 30 cents off is never the click's pitch. Click times (including output latency) are sent to the worker; in a window that overlaps a click, the tuner ignores the frame only if it reads the click's pitch (any octave), and a change to another note needs 3 frames instead of 2. Nothing else is dropped, so the tuner keeps reading at any tempo and subdivision; the playing detector follows the same rule, so practice time counts under any tempo too.
- Recording uses MediaRecorder: mp4 (AAC) first on iOS and Safari, webm/opus elsewhere. Chunks go to IndexedDB every 10 s, and an unfinished recording is recovered on the next launch.
- Recordings play (list and editor) through one route, `routeOut` in playback.ts: the first channel (at other speeds the decoded louder channel, `core/mono`) → correction gain and soft limiter (only when the recording's peak needs it) → both speakers. One channel because iOS records the mono microphone as two channels with a silent second one (WebKit 259193); the A–B WAV is cut from the louder channel as one channel.
- The editor plays through `editorPlayer`: at 1.0× an `<audio>` element on that route; at any other speed `stretchPlayer`, which decodes the recording once (up to 10 minutes, `DECODE_MAX_SEC` in core/recPolicy) and stretches it on the audio thread (`stretch.worklet` running `core/stretch`, WSOLA: 42.7 ms Hann frames at half overlap, ±10 ms search, pitch kept). iOS mishandles `playbackRate` on a media element connected to Web Audio (choppy when slow, dropped sound when fast), and every recording is connected for the route above. Changing speed while playing hands the position over; a jump while playing cross-fades over 21 ms; pause and resume ramp over one 128-sample block. Recordings are decoded one at a time (`oneAtATime` in decode.ts). Longer recordings, a browser without AudioWorklet or a failed decode use the element's own rate.

## 3. Data

| What | Where | Schema |
|---|---|---|
| Settings | `localStorage["intonome_settings_v1"]` | `{v:3, …}`, value ranges validated on read. v2 records (2.0.2–2.4.6) load; their response-speed value is mapped by level, since 2.5.0 changed the table |
| Recordings | IndexedDB `intonome_rec` v4 | `recordings` (blob) · `meta` (bookmarks, A-B, waveform, speed, extension, peak, keep) · `chunks` (pieces while recording) |
| First-run guide | `localStorage["intonome_tour_v1"]` | `new` = show when the tuner turns on, `done` = seen or closed. Written once on start: `new` only when no settings were saved (a new install), so updates never see it |
| Wake-lock notice | `localStorage["intonome_wake_warned_v1"]` | `1` once the "screen may turn off" toast has been shown on a browser without the Screen Wake Lock API — shown once per install, not on every start |
| Old names | `persist/legacy` | keys and DBs from earlier names (Go practice, TempoTune) are deleted once on start |
| Retention | `core/recPolicy` | 30-day TTL (can be turned off; deletions are announced on launch; Keep is always offered), notice in the last 7 days; a session past 60 minutes continues in a new file (`_2`, `_3`) so the in-memory parts of one file stay bounded |
| Chunks | `chunks` store | every 10 s: the blob piece plus the live peaks of that span, so a recovered recording gets its waveform and playback level |

Changing Capacitor's `androidScheme` or `appId` changes the origin, and the data above is lost.

## 4. Language and theme

- On-screen text lives in `core/i18n/ko.ts` (source) and `en.ts`; the type system requires the same keys in both. Static text in `index.html` carries `data-t` / `data-t-aria` keys that `ui/lang.ts` fills in; dynamic text calls `t(key)`.
- Korean is the default. In English, note names are always C D E and the note-name setting is hidden.
- Colors are tokens with a dark set (`:root`) and a light set (`[data-theme=light]`). The app starts in light: `<html>` carries `data-theme="light"` and the inline script in `index.html` removes it before the first paint when dark is saved.
- A small inline script in `index.html` applies the saved theme and language before the first paint.
- `scripts/i18n.test.mjs` fails if Korean text appears in code outside the dictionary. The English e2e scenario checks every screen for leftover Korean and clipped text.

## 5. Platform branches

Only `platform/index.ts` looks at `window.Capacitor`.

| Feature | Web | Android app |
|---|---|---|
| Saving files | iOS: share sheet (inside a tap) · elsewhere: `<a download>` | `@capacitor/filesystem` → `@capacitor/share` |
| Keep screen on | Wake Lock. iOS web needs a DOM tap for the first request, so it shows a start button first | Same |
| Status bar | `theme-color` meta | `@capacitor/status-bar` |
| Back button | Browser default | backButton: editor → settings → menu → mic popup → drone picker; `minimizeApp` on the main screen |
| Service worker | Precache. A new version is applied when idle; otherwise a toast offers it | Not registered |

Builds: `npm run build` (base `/intonome/`, Pages) · `npm run build:cap` (base `/`, Capacitor).

## 6. Verification

| Layer | Tool |
|---|---|
| Pure logic | Vitest `*.test.ts`, `scripts/*.test.mjs` |
| Tuner benchmark | `npm run bench`: synthetic signals: bias, p90, octave errors, lock latency, F1. Changes to the tuner or detector must not regress. `test-assets/bench/latest.md` changes only when a result changes (timing goes to the console), so `git diff` of it is the comparison |
| Browser integration | `npm run e2e`: headless Chromium with WAV files as a fake mic. `--only <regex>` |
| Visual regression | `npm run shots`: 18 screens (dark, light, English) compared with `test-assets/screens/baseline/` via pixelmatch |
| Module boundaries | `scripts/check-deps.mjs` |
| Which checks a change needs | `npm run affected` (table in `scripts/lib/affected.mjs`: changed files → unit tests via `vitest related`, e2e scenarios by name, benchmark, screenshots); `--run` runs them |

CI (`ci.yml`): check and build run side by side; the three e2e shards start after build, inside the Playwright image (its tag must equal the locked `playwright` version — `scripts/ci-image.test.mjs`), and report through one result job `e2e (fake mic WAV)`; screenshots run after check and are only uploaded. `deploy-pages.yml` deploys only when CI is green on main.

## 7. Android release

```bash
npx cap add android      # once
npm run icons            # only when the icon sources (resources/icon*.svg, wordmark.svg) change; also makes the iPhone splash images and rewrites the splash-to-app block at the top of index.html
npm run cap:assets       # launcher icons and splash screens
npm run cap:sync         # build:cap + cap sync + scripts/cap-manifest.mjs
npx cap open android
```

`cap-manifest.mjs` sets permissions (RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, INTERNET, VIBRATE for the drag ticks), portrait lock, and `versionName`/`versionCode` (major·10000 + minor·100 + patch) from package.json. Only bump `version` in package.json. Run `npm run cap:sync` right before a signed build.

Signed APK: Android Studio › Build › Generate Signed App Bundle / APK › APK. Keep the keystore outside the repo and back it up (`*.jks` is gitignored).
