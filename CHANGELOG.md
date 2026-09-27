# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [SemVer](https://semver.org/).

## [2.4.5] - 2026-09-28
- The menu no longer has its own Start recording button. REC in the header starts and stops recording; the menu lists the recordings
- Before the first recording, the menu says there are no recordings yet instead of showing an empty section
- Metronome size button: it now goes between collapsed and expanded, so collapsing takes one tap. Full screen opens by dragging the card up, and its button goes back one step to expanded
- With reduced motion turned on, pushing the metronome card up also moves it a step, so full screen can still be reached
- On a wide screen, where the metronome never collapses, the size button goes between expanded and full screen from the first tap

## [2.4.4] - 2026-09-27
- The practice timer shows in the header while it runs, between ☰ and DRONE. The bar fills with the share of the time you actually played; inside it is the time you played, next to it the elapsed time. Tap it to open the timer in the menu. It disappears when you reset the timer
- The times keep their size down to the iPhone mini and small Android phones, even past 100 minutes. On screens narrower than 338 px the bar shows only the fill, with the elapsed time still next to it
- New installs start in English with the dark theme, whatever the phone is set to. Korean and the light theme are in Settings; in Korean the note names start as 도 레 미
- The iPhone home-screen splash is dark to match
- Settings › Haptic feedback (was Vibration). On iPhone the drag ticks use the haptic of the system switch control (Safari 17.4 or later); on Android they are a little lighter
- Under the BPM, the drag hint is a drawn arrow instead of the ↕ character, which an iPhone draws like an emoji
- Expanded metronome: the beat lights in the header sit in the middle of the card
- Full-screen metronome: the −5, −, play, + and +5 buttons are a little smaller
- The settings footer shows the wordmark on one line, with the version under it

## [2.4.3] - 2026-09-27
- The icon sits on near-black instead of dark gray, so the rings and the green light stand out next to other apps. A faint light from the top keeps its edge visible on a black wallpaper
- DRONE moved next to REC on the right. ☰ stays alone on the left, like in most apps
- iPhone home-screen app: the splash no longer blinks or leaves a trace when the app appears. The app's first frame is drawn exactly like the splash and then fades into the app

## [2.4.2] - 2026-09-27
- New icon colors: the rings around the green light are amber and coral, the app's own colors, and fade outward like beats
- The icon of the web app added to an Android home screen is the same size as the installed app's. Before, the outer ring touched the edges and was cut off
- While recording, the elapsed time takes the place of REC inside the button, so nothing sits apart from it
- DRONE and REC are 30 × 64 and the text is centered in them. The gap between ☰ and DRONE looks the same as the gap between REC and ⚙
- On first launch the app follows the phone's dark mode, like the splash screen. After you change any setting, it keeps what Settings says
- The iPhone home-screen app opens on a splash screen: the round icon and the Intonome wordmark on the app's background, dark when the phone is in dark mode. Add the app to the home screen again to see it
- Vibration: dragging the metronome dial, the BPM or the A = drum gives a light tap for each step and a firmer one on every ten (80, 90 … and 440, 450 …). There is none while recording, so it stays out of the recording. Settings › Vibration turns it off. iPhone web apps have no vibration, so the setting is hidden there

## [2.4.1] - 2026-09-27
- DRONE: a new button next to ☰. Pick one of the 12 notes and it keeps sounding (octave 4, the same sound as Play A) while you practice; tap the red note to stop. Tapping DRONE again while the notes are open closes them. Like the metronome, it keeps the screen awake and stops when you leave the app. The first time you open it, a line explains what it's for
- The tuner ignores the drone and Play A. It cuts out their frequency and every whole multiple of it, which is all a phone speaker and the room can add to them, so with only them sounding the tuner shows nothing and the practice timer doesn't count it. It keeps reading you over them: other strings over Play A, and any interval over the drone. A note that sits exactly on the tone's own pitches (the same note or an octave above, within about 3 cents) is cut with it and shows nothing
- Play A and the drone sound the same and both fade in and out, so Play A no longer clicks when it starts
- Play A follows your instrument: Settings › Play A pitch sets A4 (violin, viola), A3 (cello) or A2 (double bass)
- Play A and the drone never sound together; turning one on turns the other off
- Play A lights red while it sounds, like the other buttons that are on
- DRONE and REC in the header are the same size and smaller, as tall as Play A. They are just as easy to tap
- The MIC button is gone. The tuner's start button turns the mic on, and REC turns it on and starts recording
- Reference tones left the menu; the drone replaces them
- The metronome, Play A and the drone share one soft limiter, so a click over the drone no longer clips
- When the mic closes, the tuner clears the last note right away instead of sometimes redrawing it
- The tagline is now "in tune, in time.": tuner first and metronome second, in the same order as the screen and the name
- The page title and description mention the drone
- Messages read as plain sentences instead of being split by dashes
- If recording can't start, the message suggests reloading the app (there is no mic switch to turn off and on anymore)
- When the browser has blocked the mic, the message points to the icon at the left of the address bar (Chrome no longer shows a lock there)
- Edge swipe back: a drag that stops before you lift springs back unless it passed 35 % of the width; only a drag still moving fast when you lift counts as a flick
- New app icon: three white rings around a green light on the app's dark card. The light is the tuner's in-tune green, and the rings spread out like beats. Android shows it at the same size as the iPhone does, and the splash screen shows it round on the app's background
- The settings footer shows the Intonome wordmark above the version. The tagline stays in the README and the store listing
- Full screen moved to the bottom of Settings and is an On / Off choice like the other settings. It follows the real state, so it shows Off after you leave full screen with Back or Esc

## [2.4.0] - 2026-09-25
- Renamed to **Intonome** (intonation + metronome), with a new web address: danggeun.github.io/intonome. Settings and recordings saved under the old name are cleared once
- English: Settings › Language switches between 한국어 and English (Korean stays the default). Every screen, message and label is translated; note names are C D E in English
- Recovered recordings are named with `_recovered` in English
- Repository docs are now in English
- Settings footer shows just the version, with the tagline centered under it
- Note icons (♩ next to the BPM and the rhythm buttons) redrawn from a music engraving font, with stems and beams placed by engraving rules
- New app icon: a white violin bridge with its heart and curled kidneys on the red of the app's play button, three strings over it and beat marks on both sides. Drawn crisp at each home-screen size; Android 13+ themed icons follow the wallpaper color, and the browser tab shows the bridge on a rounded tile
- Settings button in the header is drawn as a proper, symmetric gear
- Light theme is the default for new installs; a theme you already use is kept
- The collapsed metronome has a play button in its header even when stopped, so it starts and stops without expanding
- Header beat dots are one size; they no longer grow when the metronome starts
- Header beat dots stay in place when the tempo goes from two to three digits (the BPM keeps a three-digit width)
- The full-screen metronome has −5 and +5 buttons at the two ends of the row, for bigger tempo steps

## [2.3.8] - 2026-09-25
- Tuner ♭/♯ looked stretched on the iPhone start screen
- Removed the status bar notice when switching themes; it changes right away
- First-beat LED in light mode is black with a stronger glow (the counterpart of white with a glow in dark)
- Dragging the metronome card follows your finger up and down; a short drag springs back, a longer drag or a flick moves one step (upward too)
- When audio opens paused (for example right after an update), a tap anywhere starts it, not just the start button
- The iPhone home-screen app left a gap at the bottom when launched in light mode

## [2.3.7] - 2026-09-25
- Light mode: choose dark or light in Settings (dark by default)
- A three-digit BPM pushed the right-hand buttons out of the collapsed card while playing
- Expanded → full filled in from the top instead of growing upward
- The iPhone home-screen app left a gap the height of the status bar at the bottom
- The dial shows tempo terms (LARGO, ANDANTE, ALLEGRO, PRESTO) on smaller screens too

## [2.3.6] - 2026-09-25
- Removed the settings button from the menu (settings is the ⚙ in the header)
- First-beat LED is the same size as the other beats, told apart by color only, with less glow

## [2.3.5] - 2026-09-25
- Recordings are saved every 10 seconds and recovered on the next launch if the app is killed
- A new version is applied when the app is idle, otherwise you're notified. Build number next to the version in Settings
- Mac Safari records mp4 too
- Deploys only after CI passes

## [2.3.4] - 2026-09-24
### Recording and editing
- Cutting A-B from long recordings froze on iPhone
- Saving on iPhone did nothing; now it shows "Ready · Tap to save"
- Downloads from the list also convert old webm recordings to WAV for iPhone
- Cut sections get the same loudness correction as in-app playback
- Android list seek bar, editing during delete-undo, errors right after starting a recording
### Mic
- Leaving the app while the mic was opening left it open in the background
- Tapping didn't restart audio after an interruption
- Leaving and returning quickly left the start button over the tuner
### Metronome
- Dragging BPM down collapsed the card
- Rapid size taps and full → collapsed jumped
- Swiping down on Android Chrome reloaded the page
- Subdivisions stayed on in 6/8, BPM jumped after an interrupted touch, holding Space repeated

## [2.3.3] - 2026-09-22
- The full-screen metronome is now the second step of "expanded": header, mic and recording stay, and only the tuner hides
- Animated expanded ↔ full ↔ collapsed transitions. Size button shows ∧ ∧ ∨
- METRONOME title at the top of full mode
- LEDs light at the same moment as the sound
- iPhone web app: the start button turns on keep-screen-on and the mic together

## [2.3.2] - 2026-09-21
- One size button that cycles; swipe the card down to go down a step
- BPM range 40–200 (finer dial)
- Changing the time signature while playing starts from the left
- Selected time signature and rhythm: brighter with a red border. Full-screen beat flash only when collapsed
- Header: ☰ on the left, ⚙ settings on the right. Settings closes with X
- The metronome stops when you leave the app

## [2.3.1] - 2026-09-20
- Full mode fits every screen size without scrolling; dial text keeps its size
- Removed the app name from the header; full-screen toggle moved to Settings
- Removed the beat flash in full mode; first-beat LED is white
- The hint flickered while the mic was reopening
- One notation for sharps' secondary name (`A♯/B♭`)
- Subdivision note spacing

## [2.3.0] - 2026-09-17
- Hz readout on the tuner
- Full-screen metronome with a round dial (turn it to set BPM) and tempo terms
- Swipe from the left edge to go back (menu, settings, editor)

## [2.2.0] - 2026-09-17
- The mic froze after turning it off and on in iOS
- Removed the tuner needle (the trace shows the same thing)
- Subdivisions drawn as real notation (beams, triplets, dotted), sixteenths added
- "None" time signature (beats only)
- Seiko-style LED beat display
- Full-screen metronome
- The mic is released while the editor is open
- Android icon padding

## [2.1.0] - 2026-09-15
- Renamed to TempoTune, new icon, new storage and identifiers (old data cleaned up)
- Playing no longer collapses the metronome
- The permission popup appears only when the mic is really blocked
- Contrast and color adjustments; the trace is always white
- The trace broke up while playing
- The mic is released when the app is hidden so other apps can use it
- Metronome clicks were picked up as notes (automatic latency compensation)
- "Keep" for recordings (excluded from auto-delete)
- Waveforms for short recordings, undo for several deletes in a row, save and delete failures handled
- Android auto-backup off, no external font requests
- Space key, accessibility, long names, editor dragging

## [2.0.2] - 2026-09-13
- iPhone recordings were saved in a format that couldn't be opened; now they are mp4, saved via the share sheet
- The tuner display jumped when the note changed; 4-second trace window
- Sensitivity tuned so muted playing is detected
- Note names wobbled during double stops
- Pitch of the lower note in double stops
- Dark only
- Loudness correction for recording playback; metronome click volume

## [2.0.1] - 2026-09-06
- Double stops showed a lower note that wasn't played; the tuner now follows the upper voice

## [2.0.0] - 2026-09-05
- Rebuilt in TypeScript, AudioWorklet + Worker analysis, offline playing detection
- Sample-accurate metronome, single AudioContext
- Recording editor (A-B, bookmarks, waveform, speed), saving on Android
- PWA, offline, design tokens, CI

## [1.0.0] - 2026-06-01
- Single-file web prototype
