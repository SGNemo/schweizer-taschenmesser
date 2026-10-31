# Cold start and bundle – 2026-10

Goal: the app opens on a phone fast enough to catch a thought. Measured on `develop` @ `2717891` (before) and on
this branch (after), same 4 vCPU sandbox; container numbers are relative, compare rows, not absolute values.

## How to measure
- `npm run check:bundle` (web/): production build into `dist-bundle/` with `VITE_BUNDLE_REPORT=1` (Vite manifest +
  `.vite/modules.json` + `.vite/imports.json`), then per entry the critical path (entry + static imports, gzip via
  `node:zlib` level 9), the largest lazy chunks, the precache list and the budget. `-- --modules` lists the largest
  modules on the critical path; `-- --baseline` rewrites `scripts/bundle-budget.json`.
- `npm run measure:coldstart`: `e2e/screenshots/coldstart.spec.ts`, project `pixel-7`, CDP CPU 4× + "Fast 3G",
  5 runs per scenario, median. `first visit` = nothing cached; `installed` = service worker precached once, then a
  new page opens `/?capture=1` (the "Quick capture" shortcut). Metrics in ms since navigation start: first paint
  (HTML splash), `main h1` visible, quick-capture field focused.

## Before (develop)
| | Value |
|---|---|
| Critical path `index.html` | 72 requests, 2151.5 KB raw, **722.1 KB gzip** |
| Critical path `capture.html` | 22 requests, 428.0 KB gzip |
| Precache | 308 files, 7459.6 KB |
| Largest precached lazy chunks (gzip) | zxcvbn `language-en` 591 KB, `language-de` 394 KB, `language-common` 217 KB, pdf-lib 173 KB |

| Cold start (median of 5, ms) | first paint | `main h1` | capture field focused |
|---|---|---|---|
| first visit | 2628 | 10557 | 10728 |
| installed | 2356 | 8899 | 9078 |

Largest posts on the critical path (rendered size): react-dom 524 KB, tldts 296 KB (vault origin matching, pulled in
through the `@nemo/vault-core` barrel by `core/crypto/random.ts`), settings sections 230 KB (via `layout/AreaFrame` →
`pages/settings/useSections`), `strings.ts` 207 KB, dexie 198 KB, zod 179 KB, `core/ai` + minisearch 158 KB (via
`layout/CommandPalette`), date-fns 90 KB, @dnd-kit 89 KB (via `ui/SortableList`), qrcode 43 KB, @noble 56 KB
(supporter), hash-wasm 36 KB (sync key), Spotify player + strings 76 KB.
