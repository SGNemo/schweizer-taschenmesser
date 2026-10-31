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
| Critical path `index.html` | 72 requests, 722.1 KB gzip | **54 requests, 537.1 KB gzip (−25.6 %)** |
| Critical path `capture.html` | 22 requests, 428.0 KB gzip | 17 requests, 316.7 KB gzip (−26.0 %) |
| Precache | 308 files, 7459.6 KB | 338 files, **4498.3 KB (−40 %)**; 27 files load on first use |

One commit per step, critical path gzip after each: tldts off the path (`treeshake.moduleSideEffects` for vault-core +
tldts) 611.9 · Spotify player on first open 606.4 · rarely used pages lazy in `router.tsx` (library, tool list,
settings, OAuth, share) 601.5 · settings section components lazy in `pages/settings/sections.tsx` (registry stays
eager) 554.1 · weather forecast dialog on first tap + Argon2 WASM on first derivation 538.0 · vendor chunk (react,
react-router, dexie, zod, zustand: its hash survives app updates) 536.4, 54 requests.

| Cold start (median of 5, ms) | first paint | `main h1` | capture field focused |
|---|---|---|---|
| first visit, Fast 3G | 2628 → 2984 | 10557 → 8744 | **10728 → 8925** |
| installed, Fast 3G | 2356 → 2376 | 8899 → 7128 | **9078 → 7288** |
| first visit, CPU 4× only | 316 → 268 | 1361 → 1162 | 1559 → 1350 |
| installed, CPU 4× only | 256 → 232 | 1246 → 1092 | **1446 → 1281** |

- Installed PWA, CPU 4×: **1.28 s** to the focused capture field, under the 1.5 s target. With "Fast 3G" Chromium
  also delays answers that come from the service worker cache (each of the 54 requests pays the 562 ms latency on 6
  HTTP/1.1 connections of `vite preview`), so that row is pessimistic for an installed app; requests count there more
  than bytes. First paint of the first visit waits for 7 render-blocking stylesheets that now compete with the larger
  vendor chunk; it moved within the run-to-run noise of this row (develop merged in between).
- Why not −30 %: the next posts sit in files this work must not touch. `layout/AppShell.tsx` imports
  `CommandPalette` → `layout/assistant/useAssistant` → `core/ai` + minisearch eagerly; made lazy there (measured, not
  committed) the path is **502.5 KB (−30.4 %)**, 52 requests. Others: @dnd-kit via `ui/index.ts` → `SortableList`
  (~25 KB gzip), @noble via `layout/SupporterEffects` (sync API, ~14 KB), `OnboardingWizard` via
  `core/importer/host` (~17 KB). Handed to the layout owner on `scribble/BOARD.md`.
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
`web/scripts/bundle-budget.json` (+5 % tolerance): critical path 549 107 B gzip, 54 requests, 338 precache files,
4 602 814 B precached. `npm run check` shows WARN when over (never fails); CI E2E shard 1 measures its own build
(`continue-on-error`). Intended change: `npm run check:bundle -- --baseline`, commit the JSON, say why in the PR.

## Decided without asking (calmer/safer option)
- The tool library badge "Auch ohne Internet" stays: true after a tool's first open (no text change in T3's area).
- The cloud model SDK stays precached (an offline import would bypass `core/ai/providers/claude.ts`' error mapping).
- No automatic reload anywhere; back online, a reload happens only on "Erneut versuchen".
- The first vault open fetches the dictionaries in the background only online and without the browser's data saver.
- Settings sections, rarely used pages, Spotify player, weather dialog, Argon2 load lazily but stay precached
  (offline unchanged).
