# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [SemVer](https://semver.org/).

## [2.5.5] - 2026-10-25
- Tolerance is ±5, ±10 or ±15 cents, and the default is ±10 (was ±15, with ±20 and ±25 as well). At ±15 an open fifth A–E still showed green while beating about 11 times a second; at ±10 it is about 8. Since 2.5.3 the green follows the calm number, so at ±10 vibrato around a note inside the tolerance keeps it on and around a note outside keeps it off, without flicker. ±20 and ±25 turned 40 to 50 % of the ±50-cent scale green. A saved ±20 or ±25 becomes ±10; a saved ±5, ±10 or ±15 stays
- New unit tests: ±8 and ±12 cents with ±6 cents of vibrato at ±10 (green on and off, no flicker); a saved ±20 or ±25 falls back to the default
- After a note change the number, the green and the needle read the new note at once. Smoothing used to carry on from the old note, so after a slurred semitone (E–F, B–C) or a shift the number started up to 48 cents off towards the old note and crept in over 0.2–0.4 s; in eighth notes that often lasted the whole note. Now, until the median window holds only the new note (three frames, 64 ms), the needle follows the median and those frames stay out of the number's average. In the app, on synthetic scales in a small room, the number was within 2 cents of the played note 0.2 s after the note appeared: C major over two octaves in eighths at 80, 70 → 97 %; G major over three octaves with shifts in eighths at 72, 66 → 90 %; C major in quarters at 60, 72 → 98 %. Over the same eight runs the green changed after the first 0.1 s of a note 39 → 11 times. Within one note (vibrato, turning a peg), when the note name changes, and the benchmark stay the same (3 of 46 signals differ, all slightly better)
- New unit tests: four slurred semitone steps with the previous note still ringing, and the needle starting from the median after a change (the previous code fails all six)
- The pitch trace moves from note to note like a pen line. Right after a note change the analysis window still holds the old note, and those frames were drawn as a tick or a curve sweeping in from the old note's side (up to 57 cents in a shift). Now the first two frames of a new note are not drawn, as the last frame of the old one already wasn't, and the two notes are joined from one settled value to the other with a short S-curve. Where the line sits — how sharp or flat each note was, vibrato, a finger being corrected — is unchanged. On synthetic scales played with human timing, vibrato and corrections, ticks over 6 cents at note changes: C major in eighths 4 → 0, G major in quarters 5 → 0, G major over three octaves with shifts 6 → 1; every note still leaves its line, even in sixteenths at 132. The new note's line appears 43 ms later
- New unit tests: the trace skips the first two frames of a new note and joins the notes; a fast trill keeps half of every note as one line

## [2.5.4] - 2026-10-24
- With earphones, the tuner reads the same note as Play A or the drone. The app cut the tone's pitch and every multiple of it from the microphone even when the tone never reached it, so an A string tuned to Play A, or the tonic and its octave over a drone, showed "--" exactly when in tune. Now it first checks whether its tone reaches the microphone — it knows the tone's exact pitch, so it measures even a trace far below what the tuner would react to — and cuts it only then. Through the speaker nothing changes: every frame is the same as in 2.5.3
- If earphones are unplugged while the tone sounds, the app recognises its own tone at the microphone (unlike a bowed note, its level and phase don't move at all) and cuts it again within about 0.25 s, at once where the system reports the change of audio device. If the same note is already sounding when the tone starts, that stroke stays as before ("--"); the next one after a pause reads
- Synthetic, earphones: Play A with the A string from −10 to +10 cents now reads every frame within 1 cent (2.5.3: nothing in tune); over a D drone, D4 and D5 now read (2.5.3: nothing)
- Settings: card titles have a fixed line height, so the cards are the same height in Korean and English (Korean was about 5 px taller per card since 2.4.0)
- First launch follows the phone's language: a phone set to Korean opens in Korean (note names 도 레 미) from the first paint, any other language in English as before. Only when nothing is saved yet — a language chosen in Settings is kept, and existing installs don't change
- New unit tests: earphones at five offsets and over a drone (2.5.3 fails them), the speaker unchanged frame for frame, unplugging with and without a device-change notice, a faint leak against both sensitivity levels, already playing when the tone starts; the first-run language for Korean, English, Japanese and Konkani phone settings. New e2e: a bowed open A without vibrato at A = 440 keeps reading with Play A on (2.5.3 fails it); first launch on a Korean phone

## [2.5.3] - 2026-10-24
- The tuner keeps working with the metronome on, at any tempo and subdivision. Every click hid about 0.2 s from the tuner, so once clicks came closer than that, nothing was left: from 16ths at 66 bpm, triplets at 86 and 8ths at 130 the tuner showed nothing at all, even with earphones (2.5.1 lowered these limits; in 2.5.0 they were about 15 % higher). Now the click is ignored only when the tuner actually reads the click's pitch. On a held A4: 0 % → 100 % of frames at all of these settings and up to 16ths at 160 bpm; an A major scale under 16ths at 100 bpm shows every note within 0.2 s
- To make that safe, the clicks sit exactly between two notes of your reference pitch (A =) — 19 to 34 cents from the old 1800 / 1100 / 750 Hz, and they move with the A = drum. A note you play less than 30 cents off is never the click's pitch. Where a click and a high note together read like a different note for two frames, a note change inside a click needs one more frame (23 ms)
- The cents number and the green are calm. The number shows the average of the last 0.37 s (two vibrato cycles) and changes only when that average moves 1.5 cents; when the pitch moves steadily one way, as when turning a peg, it follows at once. The green uses the same number, so they always agree. The trace and the note name are as fast as before. Vibrato ±15 cents: the number changed 43 times a second, now 0; +14 cents with ±6 vibrato at the ±15 tolerance: the green flickered 9 times a second, now 0. After you stop turning a peg the number reads 0 about 0.4 s later (was 0.17 s)
- Starting a recording with the metronome on now says that the metronome is muted so it stays out of the recording, and so does starting the metronome during a recording. The beat lights keep going as before
- e2e: the card-swipe helper drags past the step threshold and pauses before letting go, so the result no longer depends on how fast the test machine is
- New unit tests: 23 metronome + tuner cases (2.5.2 fails 19), click pitches for every reference 410–466 Hz, the calm readout and the click-window switch rule

## [2.5.2] - 2026-10-24
- The pitch trace no longer shows beads along its faded, older part. Each frame's piece was stroked separately with its own transparency, and the round ends of neighbouring pieces overlapped into a brighter dot at every joint. The line is now one path per unbroken run, faded by a single gradient from top to bottom

## [2.5.1] - 2026-10-24
- With nothing played, the tuner shows nothing. A note now appears only after three consecutive frames (about 70 ms) read the same pitch within 20 cents; before, one confident frame was enough, so a syllable of distant talk, a bird or a click put a note on the screen for a moment, and since 2.5.0 it lingered half a second. On 60 s of synthetic outdoor ambience (talk snippets, birds, clicks, a passing car, wind): 2.4.6 showed a note 3 times a minute, 2.5.0 8 to 13 times, now 0. Practice time was never counted for these and still isn't
- The first note after silence shows 46 ms later than in 2.5.0 (about 120 ms after the onset instead of 70). Once a note is on the screen nothing changes: note changes, the trace, the hold after the sound stops and the tuning accuracy are the same. The microphone sensitivity setting is unrelated and unchanged
- Metronome clicks before the first note no longer put a note on the screen in the benchmark (false 12.5 -> 0 % on the clicks signal)
- New unit tests: 20 s of outdoor ambience at three noise seeds shows no note and counts no playing time; a note starting over that ambience shows within 150 ms; scattered or sliding pitches never acquire. 2.4.6 and 2.5.0 fail them

## [2.5.0] - 2026-10-24
The tuning routine on a violin — A, then D with A, G with D, E with A, each string alone — with nothing that flickers, blanks or jumps. From a tester's and the developer's own use on an iPhone (2.4.6): the G string was often not read, and bowing two strings made the display cut out "뚝 뚝 뚝".
- The G string reads. A violin G has a fundamental 15–25 dB weaker than its 2nd and 3rd partials, and a room or a phone adds low rumble. The octave check compared the lower-octave evidence with that weak fundamental, so rumble at 98 Hz passed it and G3 showed as G2 or kept switching. It now compares with the strongest partial of the note. Synthetic G3 with a −20 dB fundamental over rumble: 2.4.6 showed G3 in 60 % of frames, G2 in 16 %, nothing in 17 %; now G3 in every frame
- Two strings bowed together read as the lower string, steadily, also over rumble. A fifth (D4 + A4) repeats at the period of D3, which YIN reports; the spectrum step lifts it to D4 only if nothing sounds at D3, and rumble looked like something. The decision now also reads the shape of the series: a fifth's series has holes at the 5th and 7th multiples where one note's series would not. D4 + A4 over rumble: 2.4.6 showed D3 in 54 % of frames; now D4 in every frame (G3 + D4 and A4 + E5 likewise)
- The display never shows a note that was not measured. When a far candidate (an octave, a fifth) appears, the needle no longer glides towards it while the two-frame confirmation runs — that glide passed through B2, C♯3 and so on. It now stays on the current note and then snaps. A slide is still followed continuously
- The pitch trace is drawn with fractional cents. It used whole cents, a 1-cent (≈ 3 px) grid that made the line move in steps
- The tuner reads like a line, not a flicker. A note bowed again and again ("la~ la~ la~") shows as one continuous note and one unbroken pitch trace. Before, the rough moment of a bow change could blank the note for a few frames and cut the trace there, and a note could disappear between two strokes
- The stability check that caused it is gone: the tuner no longer hides a reading because the last few were unlike each other. One stray frame is absorbed by the pitch tracker as before; it isn't shown and it doesn't blank the screen
- After the sound stops, the note stays about half a second before it goes to "--" (was about 0.15 s), so lifting the bow between notes doesn't make the display drop out
- Tuner response (Settings) is faster at every level: a change of 25 cents settles within 3 cents about 0.45 / 0.29 / 0.22 s after the change (was 0.82 / 0.45 / 0.29 s). Your saved level is kept
- A note change is confirmed over two frames consistently; in the fastest runs the next note can show one frame (23 ms) later than in 2.4.6, which sometimes switched a frame early through the glide
- Settings are stored as version 3; settings saved by 2.0.2–2.4.6 load as before
- New unit tests: the G string over rumble, the three tuning fifths over rumble (three noise seeds each), single notes with irregular spectra never lifted an octave, a note bowed six times (G3, D3, A4, A2, E5; 40, 50 and 250 ms between strokes; two kinds of attack; three noise seeds) never blanks and leaves one unbroken trace, the note lingers ~0.5 s after the sound ends, and the needle never shows a value between two notes. 2.4.6 fails 21 of them
- Benchmark: four new signals (G3 and the three fifths over room rumble); 2.4.6 misses 15–25 % of frames on the fifths and reads a wrong harmonic in 30–50 %, 2.5.0 reads them all. The note held after a sound ends is no longer scored as a false note (it is by design). On the 42 signals shared with 2.4.6 only four numbers move: snr0 miss 2.5 → 1.3 %, staccato and cello-scale lock one frame later, and the clicks signal locks two frames later (118 ms) because the benchmark, unlike the app, doesn't mute the clicks, and a click before the onset now lingers into it. In a hall with other players 8 dB below, three seeds read 84 / 93 / 91 % of frames correctly (2.4.6: 78 / 90 / 92)

## [2.4.6] - 2026-10-03
- The tuner reads your own string in a room full of other players. It now always shows the loudest sound it hears and no longer switches to a second note above it, which in a hall meant someone else's note
- The double-stop line under the note is gone with it. A double stop reads as its lower note, steadily, like a single-note tuner
- When other sounds blur the period, the tuner no longer drops one or two octaves below your note: it prefers the shortest period the sound clearly repeats at
- In fast passages the next note can show up to about 30 ms later than before; that early switch was the same mechanism
- The benchmark has two new signals with three other players at -12 dB; 2.4.5 scored 0 on them

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
