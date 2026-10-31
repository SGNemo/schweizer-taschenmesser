# claude/friendly-tesla-ak9vb6 (T3 Reifegrad) – for the next chat:

- Maturity filter is **catalogue-only**: `availableManifests()` is untouched (routes, seed, sync, AI scope). Use `useCatalogManifests(states)` / `catalogManifests(ctx)` for a list that offers modules, `useTools()` already filters tools, `visibleSections` filters settings sections, `home/maturity.ts` the widget sheet.
- `check:modules` now also walks `src/tools/*/manifest.ts` and fails on a missing `maturity` – add the line to every new manifest (the module template has it).
- Setup steps (`layout/setup/steps/ProfilesStep.tsx`, `ToolsStep.tsx`) still list everything (T1's files); a one-liner with `isVisible` each once T1 is in.
- Section `maturity` is a required field on `SettingsSectionDef`: a new core section without it fails typecheck and `validateSections`.
- Stop 1: proposal list in `docs/product/next/03-maturity-proposal.md`; everything is `stable` until Sven ticks.
