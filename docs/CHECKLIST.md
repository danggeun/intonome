# Feature checklist

User-facing scenarios. `[A]` items are automated (CI checks them every time); `[M]` items run from a script in the development environment before each patch (`npm run shots`); `[D]` items need a real device (check once before a release).

## Startup / mic
- [A] First launch opens the mic without a popup (iOS web shows a start button first). If the browser requires a gesture, a start button appears
- [A] Permission already granted → mic turns on automatically
- [A] Permission blocked → popup explaining where to allow it; the tuner shows a start button to retry
- [A] Mic closed and not reopening (device gone, worker crash, closed by the app) → start button on the tuner; REC turns the mic on and starts recording
- [A] AudioContext starts suspended (for example after an automatic update reload) → start button, and a tap anywhere resumes
- [D] Android app: tries the mic on launch; a toast explains how to allow it if denied

## First-run guide
- [A] New install: once the tuner is on, a guide lights one part at a time (note, trace, A =, Play A, Drone, metronome, REC, menu, Settings, start card). Playing a note, sliding A = and swiping the metronome card (up, up to the metronome-only view, down, down) change the note; × / Esc close it; it never shows again
- [A] Anything changed or started during a step is put back when the step is left (A =, tempo, Play A, drone, metronome, card size); lit buttons that are only pointed out (REC) do nothing; Space doesn't start the metronome under it
- [A] An install with saved settings never sees it; Settings › App guide › Show again replays it from the first card
- [A] Wide screen: the card sits beside the tall metronome; ∧ goes to the full view and back
- [D] Android: the back button closes the guide; the status bar dims with it and comes back

## Tuner
- [A] 440 Hz input with A=442 → A4 (라4), −8 ¢ (WAV injection e2e)
- [A] Cello C2 (65 Hz) → C2 (도2)
- [A] Silence → "--", empty history
- [A] Outdoor ambience with nothing played (distant talk, birds, clicks, a passing car, wind; three noise seeds) → "--" in every frame and no playing time; a note starting over it shows within 250 ms (unit tests with the real analyzer)
- [A] Talk nearby puts fewer notes on the screen: from silence a note needs 6 steady frames (≈ 0.17 s), so a lone spoken vowel of 60–80 ms (steady or gliding, low and high voice) shows nothing while a 0.3 s one does; vibrato ±25 cents from the very first frame still acquires on the sixth; one dropped frame is skipped, two restart the count; bowed strokes on G3 / D3 / A4 / A2 / E5 show within 0.25 s of the first stroke; spiccato scales straight after a rest (16ths at 100 and 125 bpm, 8ths at 150 with gaps) show by the second note (unit tests)
- [A] Inside the tolerance the note turns green and the card gets `in-tune`; the tolerance band is a pale green zone at all times, so green that stands out means in tune
- [A] The Hz readout says the same pitch as the cents number and changes only with it: vibrato ±15 cents at 4.5 / 5.5 / 6.5 Hz never changes it more often than the number, at 5.5 Hz not at all (unit tests)
- [A] Sharps show the enharmonic flat
- [A] Reference drum (410–466 Hz) drag → A= updates, cents recalculated, setting saved
- [A] Settings: tolerance ±5/10/15 (default ±10) changes the band width
- [A] Recording: a quiet stretch longer than the 15-minute idle limit doesn't close the mic or end the recording; past 60 minutes the session continues in a new file (`_2`, shown as " (2)") and the header time keeps running; recordings deleted after 30 days are announced on launch; Keep is offered on every recording while auto-delete is on (all e2e)
- [A] Settings: response slow/normal/fast, mic sensitivity low/normal/high → saved and restored
- [A] The tuner keeps working while the metronome clicks, at any tempo and subdivision (16ths up to 160 bpm, triplets, 8ths): a held note shows in every frame with the click at 0.3× and 1× the instrument, an A major scale under 16ths at A = 415/442/466 shows every note within 0.2 s, notes on either side of each click pitch read at ±25 cents, and the clicks alone never show as a note (unit tests with the real sequencer and analyzer)
- [A] Click pitches sit exactly between two notes of the reference pitch, for every reference 410–466 Hz; no note played less than 30 cents off is taken for a click (unit tests)
- [A] The cents number and the green are calm: vibrato ±15 cents at 4.5, 5.5 and 6.5 Hz keeps the number still while the trace swings; +14 cents with ±6 vibrato at ±15 tolerance keeps the green on; after turning a peg the number reads 0 within 0.45 s; a 25-cent step reads within 3 cents when the line arrives (unit tests)
- [A] Scales: a slurred semitone step (E→F, B→C, C→B) with the previous note still ringing reads the new note's own offset within 2 cents from 0.2 s after the change; after a note change the needle starts from the new note's median, not from the old note's smoothed value (unit tests)
- [A] Trace at a note change: the last frame of the old note and the first two of the new one are not drawn, and the two notes are joined straight from one settled value to the other (no tick towards the old note); a fast trill keeps half of every note and stays one line (unit tests)
- [A] One note bowed again and again (G3 / D3 / A4 / A2 / E5; 40, 50 or 250 ms between strokes; smooth and rough attacks; three noise seeds) never goes to "--", never changes note, and leaves one unbroken pitch trace; after the sound stops the note lingers about 0.5 s (unit tests with the real analyzer)
- [A] Another player's note above yours at −10 dB (fifth, third, sixth, fourth), even if it started first, never replaces your note; two notes at the same level read as the lower one, steadily
- [A] The tuning routine over room rumble (brown noise): G3 alone with a −20 dB fundamental reads G3 in every frame; G3 + D4, D4 + A4 and A4 + E5 bowed together read the lower string in every frame (three noise seeds); single notes with irregular spectra are never shown an octave up (unit tests with the real analyzer; benchmark signals *_rumble)
- [A] The needle never shows a value between two notes: a far candidate doesn't move it until confirmed, then it snaps; a slide is followed continuously (tracker unit tests)

## Metronome
- [A] Plays without the mic
- [A] Play/stop from the card button, the header button (whenever collapsed: ▶ when stopped, ■ when playing) and the space bar
- [A] Header beat dots are one size in collapsed and expanded, playing or stopped
- [A] BPM −/+, drag (2 px per BPM), clamped to 40–200
- [A] Time signatures none/2/4/3/4/4/4/6/8, subdivisions; 6/8 disables subdivisions, counts the tempo in dotted quarters (♩. glyph in the header, a bar = two beats of three eighths) (unit tests + e2e)
- [A] Volume slider: square taper — half is −12 dB, a tenth −40 dB, 0 is silent (unit test)
- [A] Cello C2 (65 Hz), double bass B0 (30.9 Hz, 5-string), C1 (extension) and a loose E string (38.9 Hz) read their own note steadily within 0.3 s (unit tests)
- [A] Turning the A = drum while a note sounds relabels it on the very next frame; dragging 440 → 443 never moves the Hz readout (unit tests)
- [A] Collapsed and playing: the card flashes on the first beat of each bar only (other beats and subdivisions are on the LED row); the tuner header never flashes; expanded and full: no flash
- [A] Playing never changes the size; the size button goes collapsed ⇄ expanded, and from full one step down to expanded. Full is reached by dragging the card up (on a wide screen, where nothing collapses, the button goes expanded ⇄ full)
- [A] Dragging the card follows the finger: up grows a step, down shrinks a step; a short drag springs back. With reduced motion a 40 px push moves one step, up or down
- [A] Volume slider (card and full mode stay in sync) → saved and restored
- [A] While recording, clicks are silent and beats stay visible; starting a recording with the metronome on says so ("녹음 시작 · 녹음에 섞이지 않게 메트로놈 소리를 껐어요"), and so does starting the metronome during a recording (e2e)
- [A] Timing: the worklet renders 120 bpm with ≤1-sample jitter over 20 s (OfflineAudioContext e2e)
- [A] Changing BPM while playing takes effect on the next tick without restarting
- [A] Full mode fits every tested screen size without scrolling; dial text keeps its rendered size

## Play A
- [A] Tap plays A at the reference pitch and lights red; tapping again stops it
- [A] Plays without the mic and doesn't ask for it
- [A] Settings › Play A pitch (A4 / A3 / A2) is saved and restored; [D] check A3 and A2 by ear

## Drone
- [A] Header: ☰ alone on the left; DRONE, REC and ⚙ on the right. DRONE opens a 12-note picker; a note starts the drone and closes it; the button shows the note in red; tapping it stops the drone
- [A] Tapping outside only closes the picker (the tap doesn't reach the metronome); tapping DRONE again or Esc closes it
- [A] Play A and the drone turn each other off
- [A] Plays without the mic
- [A] Play A or the drone alone never shows on the tuner: all 12 drone notes and Play A4/A3/A2 at 440 and 442 Hz, through heavy speaker distortion, room echoes and noise, show nothing in every frame (unit tests with the real analyzer)
- [A] The tuner reads the player over them: an octave below, a fifth below, and a second, third, fourth, fifth, sixth and seventh above the drone; the other strings over Play A; the same note, an octave and two octaves above from 5 cents off (unit tests)
- [A] With earphones (the tone never reaches the mic) the same note reads: Play A with an A string at −10…+10 ¢ reads within 1 ¢, a drone's tonic and octave read; through the speaker every frame is the same as before; unplugging with the tone on brings the cut back within about 0.25 s (at once on `devicechange`); a faint leak counts as heard only above a tenth of the sensitivity threshold (unit tests). e2e: a bowed open A without vibrato at A = 440 keeps reading with Play A on
- [D] With earphones on a phone: Play A and the A string in tune show 0; unplug while it sounds — the tuner shows nothing while only the tone sounds
- [D] On a phone speaker: the drone sounds like Play A, the tuner shows nothing while only it or Play A sounds and reads you over it, and the screen stays on; leaving the app stops it

## Recording
- [A] Start/stop from the header REC (the menu only lists recordings); while recording the elapsed time replaces REC inside the button and the button keeps its size; the button stays still and only its dot pulses slowly (2 s)
- [A] Without the mic, REC turns it on and then records
- [A] New recording at the top of the list, named `YYYYMMDD_HHMM`, with its length
- [A] Newest one open, the rest behind "Show N older recordings"
- [A] Play/pause, seek, only one plays at a time
- [A] Delete removes it from the list and IndexedDB; undo within 5 s
- [A] List survives a restart; items older than 30 days are deleted (can be turned off); last-7-days notice with "Keep"
- [A] An unfinished recording (app killed) is recovered on the next launch
- [A] Download: browser download on the web; Filesystem + share sheet in the Android app. [D] Check the share sheet on a device

## Editor
- [A] Opens with title, 00:00 / length, play button enabled when ready
- [A] Play/pause, tap or drag the track to seek
- [A] Speed 0.5–1.5× (`preservesPitch`), remembered per recording
- [A] Set A → set B (after A only) → loop off / on / from 1 s before; drag handles or nudge ±0.25 s
- [A] Works when webm reports an infinite duration (Android MediaRecorder)
- [A] Bookmarks: add (no duplicates within 0.3 s), jump, delete
- [A] Save A–B → WAV
- [A] Waveform on the track (peaks computed once and stored)
- [A] Bookmarks and A-B are stored with the recording and survive a restart
- [A] Rename persists
- [A] Back returns to the menu, stops audio, releases handlers

## Timer
- [A] Start/stop/reset; elapsed always counts, playing time only while playing is detected (a drone alone doesn't count)
- [A] Header timer: shown only while the timer runs or holds time; played inside the bar, elapsed outside, both the same size and color (text on the fill at least 4.5:1), fill = played ÷ elapsed; tap opens the menu; reset hides it; inner time 12 px down to 338 px (iPhone mini, 360 px Android, Fold cover about 344 px), hidden below that; 105:10 / 185:40 fit and never touch DRONE
- [A] Reset shows an undo toast that restores the counts and running state
- [A] 15 minutes without sound → mic turns off with a toast

## Robustness
- [A] Offline: the service worker precache lets the tuner run after a reload without network; fonts are self-hosted
- [A] If the context is stopped from outside (iOS "interrupted"), it resumes on return; if it can't within 1.5 s, the metronome stops with a notice
- [A] App update: a new service worker is applied only when idle (no mic session in use, metronome, drone, recording or editor)
- [D] Android app going to the background saves an in-progress recording
- [A] Idle (mic off, metronome stopped, no Play A or drone) suspends the context and releases audio focus
- [A] getUserMedia errors become actionable messages (no mic / another app / HTTPS required)
- [A] No silent failures: settings save, recording storage, edit info and wake lock problems all show a toast
- [A] Worker frame p95 < 12 ms in headless Chromium. [D] Check real phones with `window.__tt.stats()`
- [D] Android back button: editor → settings → menu → mic popup → drone picker, then background on the main screen
- [D] Phone calls during and after use, Bluetooth headphone latency

## Look and feel
- [M] Screenshot baselines: 18 screens (dark, light, English) match pixel for pixel in the development environment; CI only uploads its screenshots as an artifact (its fonts differ)
- [A] Touch targets are at least 44 px (visible size unchanged)
- [A] Text and control contrast meets WCAG AA in both themes
- [A] Haptic feedback: dragging the dial, the BPM or the A = drum taps once per step (8 ms), firmer on every ten (16 ms), none while recording, none when Settings › Haptic feedback is off (kept after reload)
- [D] Haptic ticks feel like a detent, not a buzz, when spinning the dial fast; the tuner doesn't read them while dragging with the mic on; on an iPhone home-screen app (iOS 18) the ticks are felt, otherwise the row is hidden or silent
- [A] First launch: dark even with the phone in light mode; English on a phone whose first language isn't Korean (applied before the first paint, Korean source text hidden until English is in), Korean on a Korean phone (from the first paint, note names 도 레 미); then Settings › Appearance and Language; status bar follows; a language chosen in Settings is kept on a Korean phone too
- [A] Language: follows the phone's first language on first launch (Korean → Korean, anything else → English), then Settings › Language (note names then default to 도 레 미); no Korean left on any screen in English, nothing clipped, survives a reload
- [A] Header LED row fits with a three-digit BPM on 360 px phones
- [D] Readable from 60–90 cm; REC, size and drum usable while holding a bow
- [D] Larger system font sizes on the tuner card layout
- [D] Android 15 edge-to-edge: header clear of the status bar; adaptive launcher icon, and the home-screen web app icon the same size with the outer ring clear of the edges; app name "Intonome"
- [D] iPhone home-screen app: no gap at the bottom (iOS 26), nothing cut off in either theme
- [D] iPhone home-screen app opens on the splash (round icon and Intonome on the app background), dark when the phone is in dark mode; re-add the app to pick up a new splash
- [A] iPhone home-screen app: the first frame matches the splash image pixel for pixel and fades into the app before the 2.5 s safety removal; no such frame in a browser tab
- [D] iPhone home-screen app: no blink or trace between the splash and the app, with the status bar light or dark

## Settings / other
- [A] Keep screen on on/off (Wake Lock)
- [A] Playing detection: noise doesn't count; sustained string tones count after about 0.14 s (six frames) even when the first frames read wild (a click, a harmonic); a long stretch of playing followed by silence turns off within 0.25 s (unit tests). Talk nearby mostly counts as sound — the label says sound, not playing
- [A] Practice time with the metronome on: counts while the note sounds and stops when it stops, at 16ths 80–100, triplets 100 and 8ths 150 bpm; clicks alone never count (unit tests). Playback from the list doesn't count
- [A] Note names 도레미 / C D E in Korean (the other system shown small); always C D E in English
- [A] Recordings kept 30 days / forever; version shown at the bottom of Settings
- [A] Landscape on small phones (height ≤ 500 px) shows a notice
