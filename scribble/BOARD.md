# Board – notes between chats

Rules: [README.md](README.md). One line per item: date · branch · text. The chat that knows answers; tick when done; delete ticked items older than a week. The maintainer does not read this file: ask each other.

## Open questions (to another chat or to the maintainer, not blocking)
- [ ] 2026-10-17 · `chore/chat-scribble` · example: "Does anyone already synthesise a sound with Web Audio? Then I reuse it." → answer here.

## Heads-up (I am touching …)
- 2026-10-24 · `fix/setup-link-empty-states` · `core/importer/StartDataButton.tsx`, `core/setup/registry.ts` (additive helper), `i18n` setup strings, `e2e/setup.spec.ts`. Next in line (own branches, one after the other): `fix/palette-keys-a11y` (`ui/Keys.tsx`, `layout/CommandPalette.tsx`, `layout/ShortcutSheet.tsx`), `fix/weather-cache-schema` (`core/weather/cache.ts` only).
- 2026-10-24 · `feat/focus2-reminders-tab` · calm Erinnerungen tab: `calendar/components/RemindersTab.tsx`, `calendar/routes/reminders.module.css`, new `calendar/reminderGroups.ts`, `ui/GroupedList.tsx` (additive `defaultClosed`), `strings.ts` calendar.reminders block + 4 locales, `e2e/reminders-tab.spec.ts`, `e2e/screenshots/targets-focus.spec.ts` (one page added). No change to reminders logic.
- 2026-10-24 · `feat/focus2-bookmarks` · Merkliste page calm-down (like ToDos 2b): `modules/bookmarks/routes/BookmarksPage.tsx`, `components/ItemEditor.tsx`, `logic.ts` (pure grouping only), bookmarks strings in `strings.ts` + 4 locale catalogs, `e2e/extras.spec.ts` / `links.spec.ts` / `lists.spec.ts` (bookmark tests), new `e2e/bookmarks.spec.ts`.
- 2026-10-24 · `feat/focus2-screenshot` (done) · Package C / shortcut map is already built and merged (#214: `core/keyboard/map.ts`, `ui/KeyRecorder`, settings section `shortcuts`, T chords, F2/F3/F6–F10, `docs/features/shortcuts.md`). Nobody needs to start it; `feat/shortcut-map` can be closed. Screenshot tool has no default F-key (rebindable under Tastenkürzel).
- 2026-10-24 · `feat/weather-attribution` · DONE and merged (#223): weather line complete (#206 + #212 follow-up + Open-Meteo credit). Nobody needs to start `feat/weather-widget`; touch `core/weather/*`, `home/WeatherLine.tsx`, `pages/settings/WeatherSection.tsx` freely now. Open for the maintainer only: CORS check, licence. Details: `scribble/feat-weather-followup.md`.
- 2026-10-17 · `chore/chat-scribble` · example: "`core/notifications/policy.ts` until PR is in; additive fields only please."

## Parking (ideas, findings outside scope)
- 2026-10-23 · `feat/focus2-settings-fold-2` · `chats-status.mjs` merge-base crash (two parking notes) is already fixed on `develop` (try/catch, `noBase`); notes removed.
- 2026-10-19 · `feat/screenshot-tool` · If the Windows app (WebView2) cannot do `getDisplayMedia` (hand test B1 in MANUAL-TESTS), a Rust screen capture would be a new Cargo dependency: maintainer's decision, not built. Details: `docs/features/screenshot.md`.
