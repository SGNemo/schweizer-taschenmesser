# Board – notes between chats

Rules: [README.md](README.md). One line per item: date · branch · text. The chat that knows answers; tick when done; delete ticked items older than a week. The maintainer does not read this file: ask each other.

## Open questions (to another chat or to the maintainer, not blocking)
- [ ] 2026-10-17 · `chore/chat-scribble` · example: "Does anyone already synthesise a sound with Web Audio? Then I reuse it." → answer here.

## Heads-up (I am touching …)
- 2026-10-24 · `feat/tools-diff-regex` · new `web/src/tools/diff`, `web/src/tools/regex`, tool strings (`strings.ts` block `tools`, `i18n/locales/*/tools.ts`), `TOOL_CHORDS` in `core/keyboard/map.ts` (two letters, additive), `e2e/tools-diff-regex.spec.ts`.
- 2026-10-24 · `feat/notes-import` · `core/io/markdownNote.ts`, `core/io/googleKeep.ts`, `modules/notes/{importer,onboarding,manifest}.ts`, small additive `multiple` flag in `core/importer/{types,OnboardingWizard}`, `core/io/pickFile.ts`, onboarding strings.
- 2026-10-24 · `feat/phone-one-hand` · touching `core/shell/backStack.ts` (new), `ui/Dialog.tsx`, `ui/RowMenu.tsx`, `layout/CommandPalette.tsx`, small additive in `layout/AppShell.tsx`, add fields (todos/notes/quick capture) for visualViewport, `e2e/phone-paths.spec.ts` (new). Until my PR is in: additive edits only there please.
- [x] 2026-10-24 · `feat/import-todos-files` (done) · touching `core/io/{todoistCsv,googleTasks,taskImport}.ts` (new), `modules/todos/{importer,onboarding}.ts`, `core/importer/moduleImporters.test.ts` (todos block), `e2e/import-todos.spec.ts`, `onboarding.todos` strings in 5 locales (append only).
- 2026-10-24 · `fix/setup-link-empty-states` · `core/importer/StartDataButton.tsx`, `core/setup/registry.ts` (additive helper), `i18n` setup strings, `e2e/setup.spec.ts`. Next in line (own branches, one after the other): `fix/palette-keys-a11y` (`ui/Keys.tsx`, `layout/CommandPalette.tsx`, `layout/ShortcutSheet.tsx`), `fix/weather-cache-schema` (`core/weather/cache.ts` only).
- 2026-10-24 · `chore/stimulus-budget` · `web/package.json` (scripts only: `check:stimulus`, `stimulus:baseline`), `.github/workflows/ci.yml` (one new warnings-only job next to `docs-budget`), `web/e2e/screenshots/stimulus.spec.ts`, new `web/e2e/stimulus-budget.json`.
- 2026-10-24 · `feat/focus2-reminders-tab` · calm Erinnerungen tab: `calendar/components/RemindersTab.tsx`, `calendar/routes/reminders.module.css`, new `calendar/reminderGroups.ts`, `ui/GroupedList.tsx` (additive `defaultClosed`), `strings.ts` calendar.reminders block + 4 locales, `e2e/reminders-tab.spec.ts`, `e2e/screenshots/targets-focus.spec.ts` (one page added). No change to reminders logic.
- 2026-10-24 · `feat/focus2-bookmarks` · Merkliste page calm-down (like ToDos 2b): `modules/bookmarks/routes/BookmarksPage.tsx`, `components/ItemEditor.tsx`, `logic.ts` (pure grouping only), bookmarks strings in `strings.ts` + 4 locale catalogs, `e2e/extras.spec.ts` / `links.spec.ts` / `lists.spec.ts` (bookmark tests), new `e2e/bookmarks.spec.ts`.
- 2026-10-24 · `feat/focus2-screenshot` (done) · Package C / shortcut map is already built and merged (#214: `core/keyboard/map.ts`, `ui/KeyRecorder`, settings section `shortcuts`, T chords, F2/F3/F6–F10, `docs/features/shortcuts.md`). Nobody needs to start it; `feat/shortcut-map` can be closed. Screenshot tool has no default F-key (rebindable under Tastenkürzel).
- 2026-10-24 · `feat/weather-attribution` · DONE and merged (#223): weather line complete (#206 + #212 follow-up + Open-Meteo credit). Nobody needs to start `feat/weather-widget`; touch `core/weather/*`, `home/WeatherLine.tsx`, `pages/settings/WeatherSection.tsx` freely now. Open for the maintainer only: CORS check, licence. Details: `scribble/feat-weather-followup.md`.
- 2026-10-17 · `chore/chat-scribble` · example: "`core/notifications/policy.ts` until PR is in; additive fields only please."

## Parking (ideas, findings outside scope)
- 2026-10-23 · `feat/focus2-settings-fold-2` · `chats-status.mjs` merge-base crash (two parking notes) is already fixed on `develop` (try/catch, `noBase`); notes removed.
- 2026-10-19 · `feat/screenshot-tool` · If the Windows app (WebView2) cannot do `getDisplayMedia` (hand test B1 in MANUAL-TESTS), a Rust screen capture would be a new Cargo dependency: maintainer's decision, not built. Details: `docs/features/screenshot.md`.
