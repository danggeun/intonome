# scripts

Every script describes itself in its first lines (with its usage where it takes options). Scripts that import TypeScript from `www/src` need Node 22.18 or later (type stripping on by default); on Node 22.6–22.17 add `--experimental-strip-types`.

## Checks

CI runs `check-deps`, the unit tests and `e2e.mjs`, and captures screenshots without comparing them; the rest run in the development environment.

| Script | What it does |
|---|---|
| `affected.mjs` (`npm run affected`) | Picks the checks for the files that changed since `origin/main` (table in `lib/affected.mjs`); `--run` runs them |
| `check-deps.mjs` | Module boundary rules between `www/src` layers (part of `npm run check`) |
| `e2e.mjs` | Browser scenarios in headless Chromium with a WAV file as the microphone; `--only <regex>`, `--shard k/n` |
| `screenshots.mjs` | 18 screens compared with `test-assets/screens/baseline` |
| `bench.mjs` | Tuner benchmark on synthetic signals; the report in `test-assets/bench/latest.md` only changes when results change |
| `gen-signals.mjs` | Deterministic synthetic string, noise and speech signals for the benchmark and e2e |
| `*.test.mjs`, `lib/*.test.mjs` | Unit tests run by `npm test`: the scripts themselves, the on-screen text dictionary and no Korean text outside it (`i18n`), the splash tags in `index.html` (`splash`), the CI image against the lock file (`ci-image`), the benchmark metrics (`lib/bench`) |
| `lib/` | Shared helpers: tuner adapters and metrics for the benchmark (`adapter-v1`, `adapter-v2`, `metrics`, `fft` for v1), the affected-checks table, string-literal extraction for the Korean-text check (`strings`), waiting for the preview server |

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
| `sim-scale.mjs` | A synthetic scale through the real analyzer; its frames feed the two e2e trace scenarios (in tune, out of tune) |
| `busy-compare.mjs` | Before/after comparison of how busy and how wrong the tuner screen is on a fixed set |
| `metro-blip.mjs` | Whether metronome clicks show up as notes on the tuner |
| `click-level.mjs` | Click level of the metronome compared with v2.0.1 |
| `render-trace.mjs` | Renders the tuner trace in the real app from injected frames (`test-assets/trace`) |
| `ux-compare.mjs` | Side-by-side captures of several builds or CSS variants |
