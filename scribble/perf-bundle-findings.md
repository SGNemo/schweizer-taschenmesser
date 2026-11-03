# perf/bundle-findings – for the next chat (settings / perf)

Measured 2026-11-03 on develop (budget from #389: critical 654 KB gzip, 82 requests, all "ok"; nothing to re-baseline).

## Biggest lever: all settings sections are in the entry chunk
`src/pages/settings` is ~212 KB rendered (of ~623 KB) in `assets/main-*.js`, the largest block on the critical path of `index.html`.
Cause: `CommandPalette`, `AreaFrame` and `Home` use `pages/settings/useSections.ts`, which imports `sections.tsx` (`CORE_SECTIONS`), and that file imports every section component plus their string files (`strings.share`, `strings.diagnostics`, `strings.settings2`, `strings.weather`, `strings.keys`, `strings.netlog`, `strings.trash`, `SyncSection`/`BackupSection` → sync service, connectors, spotify strings).
Idea: split the registry into cheap metadata (id, title, category, order, search words, which the palette and the left column need) and a component loaded with `lazy()` when the section is opened. Needs the settings chat (`feat/settings-overhaul` owns `pages/settings/*` and `core/settings/registry/*`), so I did not touch it.

## Tried and dropped (not worth it)
- `useAssistant.ts`: dynamic import of `ask` and `searchEntries`: −2.6 KB gzip, but +4 requests (rollup splits the shared pieces into more chunks). Not kept.
- `core/importer/host.tsx`: `lazy()` for `OnboardingWizard`: no gain in gzip, +10 requests with the assistant change. Not kept.
- `core/supporter`: noble curves (14 KB gzip) are on the critical path because `deriveStatus` verifies synchronously (pinned by tests). Making it async touches a tested contract; left alone.

## Not tried
- `strings.ts` (`de`, 75 KB gzip) is one object read synchronously through a Proxy (`core/i18n/localize.ts`). Splitting it by area would mean async text access everywhere; not a small change.
- Locale catalogs are precached for all four languages (~75 KB gzip each); only the active language could be precached.
