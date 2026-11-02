# claude/friendly-tesla-ak9vb6 (T3 Reifegrad) – for the next chat:

- Maturity filter is **catalogue-only**: `availableManifests()` is untouched (routes, seed, sync, AI scope). Use `useCatalogManifests(states)` / `catalogManifests(ctx)` for a list that offers modules, `useTools()` already filters tools, `visibleSections` filters settings sections, `home/maturity.ts` the widget sheet.
- `check:modules` now also walks `src/tools/*/manifest.ts` and fails on a missing `maturity` – add the line to every new manifest (the module template has it).
- Setup steps (`layout/setup/steps/ProfilesStep.tsx`, `ToolsStep.tsx`) still list everything (T1's files); a one-liner with `isVisible` each once T1 is in.
- Section `maturity` is a required field on `SettingsSectionDef`: a new core section without it fails typecheck and `validateSections`.
- Stop 1 answered 2026-11-01: 12 entries are `preview` (see `docs/product/next/03-maturity-proposal.md`). **E2E of a preview feature** (chat, maps, diff/regex, screenshot, local API, share, network, extension, reading aid, voice, Spotify): call `showPreview(page)` from `e2e/helpers.ts` in a `beforeEach` before the first navigation, otherwise the card/section/tool is not there.
- A preview settings section needs an "in use" signal in `useSectionsInUse()` (`pages/settings/useSections.ts`) so it stays reachable while on; `browser-extension` has none (it is a link row, only visible with the vault).
- Field-level maturity (reminder fields, game-mode card) is not built: a `FoldedGroup` "In Arbeit" inside the section would be the smallest shape.
