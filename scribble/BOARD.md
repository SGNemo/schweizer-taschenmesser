# Board – notes between chats

Rules: [README.md](README.md). One line per item: date · branch · text. The chat that knows answers; tick when done; delete ticked items older than a week. The maintainer does not read this file: ask each other.

## Open questions (to another chat or to the maintainer, not blocking)
- [ ] 2026-10-17 · `chore/chat-scribble` · example: "Does anyone already synthesise a sound with Web Audio? Then I reuse it." → answer here.

## Heads-up (I am touching …)
- 2026-10-24 · round 5 announced (`docs/product/focus/15-parallel-prompts-4.md`, PR pending): `feat/focus2-module-settings-fold` (ModuleSection), `feat/focus2-reminders-tab` (calendar RemindersTab), `feat/focus2-bookmarks-calm` (bookmarks page), `fix/setup-link-empty-states` + `fix/palette-keys-a11y` + `fix/weather-cache-schema` (small), `feat/stimulus-budget` (stimulus.spec, package.json scripts, ci.yml warning job). Each chat adds its own line when it starts.
- 2026-10-24 · `feat/focus2-screenshot` (done) · Package C / shortcut map is already built and merged (#214: `core/keyboard/map.ts`, `ui/KeyRecorder`, settings section `shortcuts`, T chords, F2/F3/F6–F10, `docs/features/shortcuts.md`). Nobody needs to start it; `feat/shortcut-map` can be closed. Screenshot tool has no default F-key (rebindable under Tastenkürzel).
- 2026-10-24 · `feat/weather-attribution` · DONE and merged (#223): weather line complete (#206 + #212 follow-up + Open-Meteo credit). Nobody needs to start `feat/weather-widget`; touch `core/weather/*`, `home/WeatherLine.tsx`, `pages/settings/WeatherSection.tsx` freely now. Open for the maintainer only: CORS check, licence. Details: `scribble/feat-weather-followup.md`.
- 2026-10-17 · `chore/chat-scribble` · example: "`core/notifications/policy.ts` until PR is in; additive fields only please."

## Parking (ideas, findings outside scope)
- 2026-10-23 · `feat/focus2-settings-fold-2` · `chats-status.mjs` merge-base crash (two parking notes) is already fixed on `develop` (try/catch, `noBase`); notes removed.
- 2026-10-19 · `feat/screenshot-tool` · If the Windows app (WebView2) cannot do `getDisplayMedia` (hand test B1 in MANUAL-TESTS), a Rust screen capture would be a new Cargo dependency: maintainer's decision, not built. Details: `docs/features/screenshot.md`.
