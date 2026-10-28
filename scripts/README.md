# scripts

Every script states its usage in its first lines. Scripts that import TypeScript from `www/src` need Node 22.18 or later (type stripping on by default); on an older Node 22 add `--experimental-strip-types`.

## Checks (CI and every patch)

| Script | What it does |
|---|---|
| `affected.mjs` (`npm run affected`) | Picks the checks for the files that changed since `origin/main` (table in `lib/affected.mjs`); `--run` runs them |
| `check-deps.mjs` | Module boundary rules between `www/src` layers (part of `npm run check`) |
| `e2e.mjs` | Browser scenarios in headless Chromium with a WAV file as the microphone; `--only <regex>`, `--shard k/n` |
| `screenshots.mjs` | 18 screens compared with `test-assets/screens/baseline` |
| `bench.mjs` | Tuner benchmark on synthetic signals; the report in `test-assets/bench/latest.md` only changes when results change |
| `gen-signals.mjs` | Deterministic synthetic string, noise and speech signals for the benchmark and e2e |
| `*.test.mjs` | Unit tests for the scripts themselves and the on-screen text dictionary (run by `npm test`) |

## Build and release

| Script | What it does |
|---|---|
| `gen-icons.mjs`, `gen-splash.mjs` | App icons and iPhone splash images from `resources/` (`npm run icons`) |
| `cap-icons.mjs` | Fixes the Android adaptive icons after `capacitor-assets generate` |
| `cap-manifest.mjs` | Android manifest: permissions, portrait, version (`npm run cap:sync` runs it) |
| `gen-note-glyphs.py` | Note glyphs (Bravura) written into `index.html` and `style.css` |

## Investigation tools (not run by CI)

| Script | What it does |
|---|---|
| `analyze-recording.mjs` | Runs a real recording (mono WAV) through the analyzer: shown frames, impossible notes, frame time |
| `sim-scale.mjs` | A synthetic scale through the real analyzer; its frames feed one e2e trace scenario |
| `busy-compare.mjs` | Before/after comparison of how busy and how wrong the tuner screen is on a fixed set |
| `metro-blip.mjs` | Whether metronome clicks show up as notes on the tuner |
| `click-level.mjs` | Click level of the metronome compared with v2.0.1 |
| `render-trace.mjs` | Renders the tuner trace in the real app from injected frames (`test-assets/trace`) |
| `ux-compare.mjs` | Side-by-side captures of several builds or CSS variants |
