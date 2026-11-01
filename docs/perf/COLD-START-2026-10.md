# Cold start and bundle – 2026-10

Goal: the app opens on a phone fast enough to catch a thought. Measured on `develop` @ `2717891` (before) and on
this branch with `develop` merged (after, 14 more commits incl. the mobile header), same 4 vCPU sandbox; container
numbers are relative, compare rows, not absolute values.

## How to measure
- `npm run check:bundle` (web/): production build into `dist-bundle/` with `VITE_BUNDLE_REPORT=1` (Vite manifest +
  `.vite/modules.json` + `.vite/imports.json`), then per entry the critical path (entry + static imports, gzip via
  `node:zlib` level 9), the largest lazy chunks, the precache list and the budget. `-- --modules` lists the largest
  modules on the critical path; `-- --baseline` rewrites `scripts/bundle-budget.json`.
- `npm run measure:coldstart`: `e2e/screenshots/coldstart.spec.ts`, project `pixel-7`, CDP CPU 4× + "Fast 3G",
  5 runs per scenario, median. `first visit` = nothing cached; `installed` = service worker precached once, then a
  new page opens `/?capture=1` (the "Quick capture" shortcut). Metrics in ms since navigation start: first paint
  (HTML splash), `main h1` visible, quick-capture field focused. `COLDSTART_NET=0` keeps CPU 4× but drops the network
  profile; raw runs land in `web/node_modules/.cache/coldstart/<label>.json`.

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

## After (this branch)
| | Before | After |
|---|---|---|
| Critical path `index.html` | 72 requests, 722.1 KB gzip | **68 requests, 601.0 KB gzip (−16.8 %)** |
| Critical path `capture.html` | 22 requests, 428.0 KB gzip | 18 requests, 325.3 KB gzip (−24.0 %) |
| Precache | 308 files, 7459.6 KB | 313 files, **4617.8 KB (−38 %)**; 27 files load on first use |

One commit per step, critical path gzip after each: tldts off the path (`treeshake.moduleSideEffects` for vault-core +
tldts) 611.9 · Spotify player on first open 606.4 · library, tool list, OAuth and share page lazy in `router.tsx`
601.5 · weather forecast dialog on first tap + Argon2 WASM on first derivation · vendor chunk (react, react-router,
dexie, zod, zustand: its hash survives app updates) · final 601.0, 68 requests. Split-off parts use `lazyOnline`:
precached as before; offline without a service worker a calm note instead of an error screen.

Tried and reverted: settings section components lazy (−47 KB gzip, 54 requests, 537 KB = −25.6 %). Offline
client-side navigation into Settings without a service worker (sync E2E "offline edits") then needs the sections
loaded beforehand; preloading them right after the render cost ~0.7 s to the capture field, preloading in the idle
slot made other specs flaky under load (3 of 27 repeated runs, 0 without). Settings stay in the start bundle.

Final numbers: before (worktree at the measurement commit) and after measured back to back on the same sandbox (a
slower one than the first "before" above). CPU-only rows: median of 10 runs, interleaved; Fast 3G rows: median of 5.

| Cold start (ms) | first paint | `main h1` | capture field focused |
|---|---|---|---|
| first visit, Fast 3G | 2648 → 3128 | 10704 → 10348 | 10863 → 10564 (−3 %) |
| installed, Fast 3G | 2392 → 2388 | 8978 → 8993 | 9141 → 9209 (noise) |
| first visit, CPU 4× only | 336 → 308 | 1424 → 1423 | 1608 → 1597 |
| installed, CPU 4× only | 284 → 284 | 1476 → 1333 | **1635 → 1530 (−6 %)** |

- The < 1.5 s target (installed, CPU 4×) is not reached on this sandbox (1.53 s); on the first, faster sandbox the
  same build path measured 1.45 → 1.28 s with the settings split, which is reverted now.
- With "Fast 3G" Chromium also delays answers from the service worker cache: each of the 68 requests pays the
  562 ms latency on 6 HTTP/1.1 connections of `vite preview`, so request count, not bytes, decides that row (the
  settings split took it to 54 requests and 7.3 s). First paint of the first visit waits for 7 render-blocking
  stylesheets that now compete with the larger vendor chunk (+0.5 s); what follows is earlier.
- The precache is the clear gain: 7.46 → 4.62 MB for the first install and every update.

- Why not −30 %: Settings stay eager (above). The next post sits in a file this work must not touch:
  `layout/AppShell.tsx` imports `CommandPalette` → `layout/assistant/useAssistant` → `core/ai` + minisearch eagerly
  (~35 KB gzip; measured lazy, not committed). Others: @dnd-kit via `ui/index.ts` → `SortableList` (~25 KB),
  @noble via `layout/SupporterEffects` (sync API, ~14 KB), `OnboardingWizard` via `core/importer/host` (~17 KB),
  `qrcode-generator` via `pages/settings/ShareQr.tsx` (~13 KB, just reworked in #338). Handed over on
  `scribble/BOARD.md`.
- Unchanged on purpose: `index.html` (Vite already preloads exactly the critical path; Inter is local with
  `font-display: swap`), `core/modules/registry.ts` (manifests are small; the chat manifest pulls schema, settings
  and migrations only, ~3 KB), the quick bar (`umrechnen 5 km`, `timer 10m` use `tools/*/logic.ts`, which stays in a
  precached chunk; no tool view loads for them).

## What loads on first use (precache split)
Rule `web/scripts/lib/precacheSplit.ts`: everything reachable from the entries without stepping through a dynamic
import into an online root stays precached. Online roots: `src/tools/*/View.tsx` (each `Tool.tsx` is a thin
precached `lazyOnline` entry), `src/modules/chat/routes/ChatView.tsx`, `@zxcvbn-ts/*`. The service worker keeps them
after the first online use (`src/pwa/lazyCache.ts`, cache-first, newest 80 files). Never loaded and offline: a calm
status line (`core/net/OnlineChunk.tsx`, `strings.offline.ts`); back online "Erneut versuchen" reloads, because
Chromium remembers a failed dynamic import for the page. Proof: `web/e2e/offline.spec.ts`.

## Budget
`web/scripts/bundle-budget.json` (+5 % tolerance): critical path 615 396 B gzip, 68 requests, 313 precache files,
4 728 579 B precached. `npm run check` shows WARN when over (never fails); CI E2E shard 1 measures its own build
(`continue-on-error`). Intended change: `npm run check:bundle -- --baseline`, commit the JSON, say why in the PR.

## Decided without asking (calmer/safer option)
- The tool library badge "Auch ohne Internet" stays: true after a tool's first open (no text change in T3's area).
- The cloud model SDK stays precached (an offline import would bypass `core/ai/providers/claude.ts`' error mapping).
- No automatic reload anywhere; back online, a reload happens only on "Erneut versuchen".
- The first vault open fetches the dictionaries in the background only online and without the browser's data saver.
- Settings stay in the start bundle (offline without a worker must not depend on timing); the other split-off parts
  stay precached and show a calm note offline without a worker.
