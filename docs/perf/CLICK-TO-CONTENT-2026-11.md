# Click to content – 2026-11

UI audit package 0b-8, item "Performance: Öffnen und Klicken fühlt sich überall langsam an" plus the start-bundle budget from "Aus S-b" ([PACKAGES](../design/ui-audit-2026-11/PACKAGES.md)). Step 1: measured on `develop` 03e24fb3, nothing changed in the app. The hand test on devices is in [MANUAL-TESTS](../MANUAL-TESTS.md) (PF-K1 … PF-K6).

## Method

`npm run measure:click` (`web/e2e/perf/click.spec.ts`, config `web/playwright.click.config.ts`, tables `node scripts/click-table.mjs`):

- Seed `medium`, production build (`build:e2e-seed`, preview on :4174, service worker blocked), Chromium in the container (4 cores). Desktop 1920×1080; phone 412×915 with touch. CPU throttled by CDP `Emulation.setCPUThrottlingRate` 4× and 6×.
- **Click** = the router's own navigation (`pushState` + `popstate`, what a link does after its handler); dialogs = a real click on the page's main action.
- **First** = the first frame with the new page's `h1` (or the dialog) visible; **done** = the last change in `main`/the dialog or the last IndexedDB answer before 600 ms of quiet, with no loading card, skeleton, `aria-busy` or "…" status left. Cap 15 s (no target reached it).
- **1st visit** = right after a reload, starting on `/` (overview from `/todos`, dialogs on their module page); **2nd** = after going back to the start page. Each value is the median of 3 runs.
- Cause trail of the 1st visit: script/style files requested after the click, IndexedDB requests and rows (per store too), CDP task time (main thread), time a loading state was visible. `CLICK_PROFILE=fn` adds a sampled CPU profile per function (best with an unminified build: `vite build --mode e2e-seed --outDir dist-e2e-seed --minify false`, then `npm run preview:e2e-seed` before the run).

Limits:
- Files come from the HTTP cache after the reload (like the precache of an installed app), so the count is meaningful but the size is not. Network time is not in these numbers.
- The overview has no "first" value: the old page's heading counts at once. The probe itself costs a little (`querySelectorAll` per frame, about 50–150 ms of 6× time on big pages).
- A full run takes about 1.6 h (62 targets × 3 runs × 2 rates × 2 devices). Spread between runs is up to ±40 % on single targets (settings 1.1–2.2 s at 6×), so compare medians only.

## Times (seconds, first / done)

| target | desktop 4x 1st | 2nd | desktop 6x 1st | 2nd | phone 4x 1st | 2nd | phone 6x 1st | 2nd |
|---|---|---|---|---|---|---|---|---|
| overview | – / 1.1 | – / 0.8 | – / 1.9 | – / 1.3 | – / 1.2 | – / 0.7 | – / 1.9 | – / 1.2 |
| settings | 0.2 / 0.7 | 0.3 / 0.7 | 0.3 / 1.6 | 0.5 / 1.5 | 0.2 / 0.6 | 0.3 / 0.8 | 0.3 / 1.4 | 0.4 / 1.0 |
| library | 0.5 / 0.6 | 0.2 / 0.3 | 0.6 / 0.7 | 0.4 / 0.5 | 0.5 / 0.5 | 0.1 / 0.2 | 0.5 / 1.1 | 0.3 / 0.4 |
| accounts | 0.4 / 0.4 | 0.1 / 0.1 | 0.5 / 0.5 | 0.1 / 0.2 | 0.4 / 0.4 | 0.1 / 0.1 | 0.4 / 0.5 | 0.1 / 0.2 |
| accounts (dialog) | no dialog (Entsperren) |  | no dialog (Entsperren) |  | no dialog (Entsperren) |  | no dialog (Entsperren) |  |
| bookmarks | 0.5 / 0.6 | 0.1 / 0.2 | 0.5 / 0.6 | 0.2 / 0.3 | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 0.7 | 0.2 / 0.4 |
| bookmarks (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 |
| browser | 0.4 / 0.5 | 0.1 / 0.3 | 0.5 / 0.6 | 0.2 / 0.5 | – | – | – | – |
| browser (dialog) | no dialog |  | no dialog |  | – | – | – | – |
| budgets | 0.4 / 0.7 | 0.1 / 0.3 | 0.5 / 1.2 | 0.2 / 0.7 | 0.4 / 0.6 | 0.1 / 0.3 | 0.5 / 0.8 | 0.2 / 0.5 |
| budgets (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.0 / 0.0 | 0.1 / 0.1 | 0.1 / 0.1 |
| calendar | 0.5 / 1.2 | 0.2 / 0.9 | 0.6 / 2.2 | 0.3 / 1.5 | 0.5 / 1.0 | 0.1 / 0.7 | 0.6 / 1.3 | 0.2 / 1.1 |
| calendar (dialog) | 0.1 / 0.2 | 0.1 / 0.3 | 0.2 / 0.8 | 0.2 / 0.3 | 0.1 / 0.2 | 0.1 / 0.1 | 0.2 / 0.3 | 0.1 / 0.3 |
| chat | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.5 | 0.2 / 0.3 | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.6 | 0.1 / 0.2 |
| chat (dialog) | no dialog (KI-Anbieter einrichten) |  | no dialog (KI-Anbieter einrichten) |  | no dialog (KI-Anbieter einrichten) |  | no dialog (KI-Anbieter einrichten) |  |
| clock | 0.4 / 0.5 | 0.2 / 0.3 | 0.5 / 0.7 | 0.2 / 0.4 | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 0.9 | 0.1 / 0.3 |
| clock (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 |
| device | 0.4 / 0.5 | 0.2 / 0.3 | 0.5 / 0.8 | 0.2 / 0.3 | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.6 | 0.2 / 0.3 |
| device (dialog) | no dialog |  | no dialog |  | 0.1 / 0.2 | 0.0 / 0.1 | 0.3 / 0.4 | 0.1 / 0.1 |
| disk | 0.5 / 0.5 | 0.1 / 0.2 | 0.6 / 0.6 | 0.3 / 0.6 | – | – | – | – |
| disk (dialog) | no dialog |  | no dialog |  | – | – | – | – |
| downloads | 0.4 / 0.5 | 0.1 / 0.2 | 0.6 / 0.6 | 0.2 / 0.3 | – | – | – | – |
| downloads (dialog) | 0.1 / 0.1 | 0.0 / 0.0 | 0.1 / 0.1 | 0.1 / 0.1 | – | – | – | – |
| feeds | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.5 | 0.2 / 0.3 | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.5 | 0.1 / 0.3 |
| feeds (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.0 / 0.0 | 0.1 / 0.1 | 0.1 / 0.1 |
| finance | 0.4 / 2.6 | 0.1 / 1.6 | 0.5 / 3.6 | 0.2 / 3.0 | 0.4 / 1.7 | 0.1 / 1.4 | 0.5 / 2.7 | 0.2 / 2.5 |
| finance (dialog) | 0.3 / 0.6 | 0.2 / 0.5 | 0.3 / 0.7 | 0.2 / 0.6 | 0.2 / 0.5 | 0.2 / 0.5 | 0.3 / 0.7 | 0.2 / 0.5 |
| fitness | 0.4 / 0.6 | 0.1 / 0.3 | 0.5 / 0.7 | 0.2 / 0.5 | 0.4 / 0.6 | 0.1 / 0.4 | 0.5 / 1.0 | 0.2 / 0.5 |
| fitness (dialog) | 0.1 / 0.2 | 0.2 / 0.2 | 0.2 / 0.2 | 0.1 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.5 |
| habits | 0.4 / 0.6 | 0.1 / 0.3 | 0.5 / 0.8 | 0.2 / 0.6 | 0.4 / 0.5 | 0.1 / 0.3 | 0.6 / 1.3 | 0.2 / 0.4 |
| habits (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 |
| invoices | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 0.7 | 0.3 / 0.5 | 0.4 / 0.5 | 0.1 / 0.2 | 0.6 / 0.7 | 0.1 / 0.3 |
| invoices (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 |
| lists | 0.4 / 0.5 | 0.1 / 0.3 | 0.5 / 1.0 | 0.2 / 0.4 | 0.4 / 0.6 | 0.1 / 0.2 | 0.5 / 0.9 | 0.2 / 0.4 |
| lists (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | no dialog (Hinzufügen) |  | no dialog (Hinzufügen) |  |
| mail | 0.4 / 1.0 | 0.1 / 0.5 | 0.5 / 2.3 | 0.2 / 0.9 | – | – | – | – |
| mail (dialog) | no dialog |  | no dialog |  | – | – | – | – |
| maps | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 0.8 | 0.2 / 0.4 | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 1.1 | 0.2 / 0.4 |
| maps (dialog) | 0.2 / 0.2 | – | 0.2 / 0.2 | – | 0.2 / 0.2 | – | 0.2 / 0.2 | – |
| music | 0.4 / 0.4 | 0.1 / 0.2 | 0.6 / 0.6 | 0.2 / 0.2 | 0.4 / 0.4 | 0.1 / 0.1 | 0.5 / 0.5 | 0.2 / 0.2 |
| music (dialog) | no dialog (Zu den Verbindungen) |  | no dialog (Zu den Verbindungen) |  | no dialog (Zu den Verbindungen) |  | no dialog (Zu den Verbindungen) |  |
| notes | 0.4 / 0.9 | 0.1 / 0.3 | 0.5 / 1.3 | 0.2 / 0.5 | 0.4 / 0.6 | 0.2 / 0.3 | 0.7 / 1.1 | 0.2 / 0.3 |
| notes (dialog) | no dialog (Neue Seite) |  | no dialog (Neue Seite) |  | no dialog (Notiz) |  | no dialog (Notiz) |  |
| pantry | 0.4 / 0.8 | 0.1 / 0.7 | 0.5 / 1.4 | 0.2 / 1.0 | 0.5 / 1.0 | 0.1 / 0.6 | 0.5 / 1.2 | 0.2 / 0.8 |
| pantry (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.2 |
| people | 0.4 / 0.6 | 0.2 / 0.3 | 0.5 / 1.1 | 0.2 / 0.5 | 0.5 / 0.6 | 0.1 / 0.2 | 0.5 / 0.9 | 0.2 / 0.5 |
| people (dialog) | 0.1 / 0.2 | 0.1 / 0.1 | 0.2 / 0.2 | 0.2 / 0.3 | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.2 |
| planner | 0.4 / 0.7 | 0.1 / 0.4 | 0.5 / 1.0 | 0.2 / 0.7 | 0.4 / 0.8 | 0.1 / 0.4 | 0.5 / 1.3 | 0.2 / 0.6 |
| planner (dialog) | no dialog (Eintragen) |  | no dialog (Eintragen) |  | no dialog (Eintragen) |  | no dialog (Eintragen) |  |
| routines | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.9 | 0.2 / 0.3 | 0.4 / 0.4 | 0.1 / 0.2 | 0.5 / 0.8 | 0.2 / 0.3 |
| routines (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 |
| subscriptions | 0.4 / 0.6 | 0.1 / 0.2 | 0.5 / 0.7 | 0.2 / 0.4 | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 0.6 | 0.1 / 0.3 |
| subscriptions (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.2 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.1 |
| timetrack | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 1.0 | 0.2 / 0.4 | 0.5 / 0.6 | 0.1 / 0.2 | 0.5 / 1.1 | 0.2 / 0.3 |
| timetrack (dialog) | no dialog (Start) |  | no dialog (Stopp) |  | no dialog (Start) |  | no dialog (Stopp) |  |
| todos | 0.5 / 0.7 | 0.1 / 0.3 | 0.5 / 1.2 | 0.3 / 0.7 | 0.4 / 0.7 | 0.1 / 0.4 | 0.5 / 0.9 | 0.2 / 0.6 |
| todos (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.4 | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.2 / 0.2 |
| vault | 0.4 / 0.5 | 0.2 / 0.3 | 0.5 / 1.0 | 0.2 / 0.4 | 0.4 / 0.5 | 0.1 / 0.2 | 0.5 / 1.0 | 0.2 / 0.3 |
| vault (dialog) | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.1 / 0.1 | 0.1 / 0.1 | 0.1 / 0.1 | 0.2 / 0.2 | 0.2 / 0.2 |
| weather | 0.4 / 0.4 | 0.1 / 0.1 | 0.5 / 0.6 | 0.2 / 0.3 | 0.5 / 0.5 | 0.1 / 0.2 | 0.6 / 0.6 | 0.2 / 0.2 |
| weather (dialog) | no dialog (Ort wählen) |  | no dialog (Ort wählen) |  | no dialog (Ort wählen) |  | no dialog (Ort wählen) |  |

"no dialog": the main action is not an entry dialog (chat → AI setup, music → connections, notes → new page, planner → inline entry, timetrack → start/stop, weather → place picker, accounts → unlock; mail, browser, device and disk have no matching button). Maps: the dialog stays open on Escape, so only the 1st visit is counted.

Reading: most module pages are done in 0.4–0.7 s at 4× and 0.5–1.0 s at 6×; **dialogs are fast** (0.1–0.2 s; finance 0.6–0.7 s, calendar up to 0.8 s). The slow ones are finance (3.6 s desktop 6×, 2.7 s phone), mail (2.3 s), calendar (2.2 s), overview (1.9 s), settings (1.6 s, and the **2nd visit is as slow as the 1st**), pantry (1.4 s), notes (1.3 s).

## Causes (1st visit, 6×, targets ≥ 1.0 s)

| target | device | done (s) | files after the click | DB reads (requests, rows) | main thread (ms) | loading state shown (ms) |
|---|---|---|---|---|---|---|
| overview | desktop | 1.9 | 18 | 142, 2721 | 2041 | 677 |
| overview | phone | 1.9 | 18 | 144, 2649 | 1793 | 797 |
| settings | desktop | 1.6 | 0 | 116, 845 | 1208 | 0 |
| settings | phone | 1.4 | 0 | 109, 699 | 1070 | 0 |
| library | phone | 1.1 | 8 | 4, 50 | 774 | 279 |
| budgets | desktop | 1.2 | 4 | 29, 569 | 1054 | 210 |
| calendar | desktop | 2.2 | 17 | 106, 3108 | 2199 | 239 |
| calendar | phone | 1.3 | 17 | 89, 2419 | 1169 | 231 |
| finance | desktop | 3.6 | 13 | 73, 1869 | 3695 | 570 |
| finance | phone | 2.7 | 13 | 72, 1820 | 2753 | 488 |
| fitness | phone | 1.0 | 5 | 10, 165 | 883 | 281 |
| habits | phone | 1.3 | 5 | 8, 794 | 1909 | 381 |
| lists | desktop | 1.0 | 4 | 11, 200 | 1012 | 210 |
| mail | desktop | 2.3 | 9 | 29, 338 | 3048 | 887 |
| maps | phone | 1.1 | 4 | 10, 74 | 917 | 280 |
| notes | desktop | 1.3 | 11 | 10, 149 | 1476 | 680 |
| notes | phone | 1.1 | 8 | 10, 132 | 853 | 283 |
| pantry | desktop | 1.4 | 8 | 50, 1227 | 1426 | 249 |
| pantry | phone | 1.2 | 8 | 50, 1194 | 1246 | 244 |
| people | desktop | 1.1 | 4 | 9, 139 | 1263 | 274 |
| planner | desktop | 1.0 | 11 | 37, 1046 | 985 | 334 |
| planner | phone | 1.3 | 11 | 40, 1015 | 903 | 305 |
| timetrack | desktop | 1.0 | 6 | 10, 187 | 927 | 257 |
| timetrack | phone | 1.1 | 6 | 10, 178 | 674 | 281 |
| todos | desktop | 1.2 | 10 | 21, 379 | 1579 | 284 |
| vault | desktop | 1.0 | 6 | 10, 161 | 984 | 328 |
| vault | phone | 1.0 | 6 | 10, 152 | 1082 | 316 |

Most read stores (desktop 6×, 1st visit): overview `_meta` 54, `_settings` 18, `_modules` 9, `finance_transaction` 8; settings `_meta` 60, `_settings` 36, `_modules` 12; calendar and pantry both read `finance_account`/`finance_transaction` 8 times each.

### Large items, by cause

| # | Cause | Where | Evidence | Affects |
|---|---|---|---|---|
| 1 | **Start bundle** over budget | `web/src/router.tsx` imports `SettingsLayout` (+ `sections.tsx`, settings strings) statically; `@dnd-kit` via Home; 44 of 86 critical chunks are < 1 KB gzip (19 KB together) | `check:bundle`: 756.9 KB / 97 requests (limits 754.8 KB / 93; precache 590 files, limit 583). Settings code ≈ 290 KB raw of 3 546 KB on the critical path (≈ 60 KB gzip), dnd-kit ≈ 96 KB raw | cold start, every first click |
| 2 | **DB reads on open: settings** | `useSettingsSections()` called in 9 places in `pages/settings/SettingsLayout.tsx`/`SettingsHead.tsx`, each with its own module-state and section queries; `useModuleStates()` 4× more; `useChecklist` runs the setup checks; `useUsageRows` (`core/ai/usage.ts`) reads all of `_aiUsage` to sum today | 116 requests per visit, also on the 2nd visit (1.5 s), no file loaded | settings, every visit |
| 3 | **DB reads on open: "Jetzt" strip and overview** | `NowStrip` (`core/modules/NowStrip.tsx`) on finance, pantry, calendar calls `useAttentionItems()`, which loads the attention chunk of **every** active module and runs its queries, then keeps 1–3 modules; `useSharedLiveQuery` drops a query 50 ms after its last user (`core/modules/sharedQuery.ts` `LINGER_MS`), so every page change runs it again. Home (`home/Home.tsx` 185–206) waits for attention + agenda (9 calendar sources) before it mounts the lazy widgets, which then load and read one after another | pantry/calendar read finance stores 8×; overview 142 requests, 2 721 rows, 18 files, loading state 0.7–0.8 s | overview, finance, pantry, calendar |
| 4 | **Main-thread work on first render: finance** | `modules/finance/summary.ts` `useFinanceData` reads all transactions; `totalBalance` 3×, `OverviewTab` six passes over all transactions, `useForecast`, the wide-screen `TransactionsTab` sort, all unmemoized; Recharts (`Charts`) in the profile | 3.7 s task time at 6× desktop, 2nd visit 3.0 s (code cached, so it is render work) | finance, finance dialog (0.7 s) |
| 5 | **Code loaded on the first click** | every module route is `lazyComponent` (4–18 files); the page shows `PageLoadingCard` meanwhile | every module: loading state 0.2–0.4 s at 6× on the 1st visit, 2nd visit 0.2–0.4 s faster | all modules (small each, everywhere) |
| 6 | **Forced style reads during render** | `ui/pageWidth.ts` `remPx()` calls `getComputedStyle` in the `useSyncExternalStore` snapshot of `usePageWidthAtLeast`, i.e. on every render of every consumer | profile self time 147 ms (todos), 64–70 ms (calendar, mail) at 6× | master–detail pages |
| 7 | Mail render | `modules/mail/routes/MailPage.tsx` | 3.0 s task time, loading state 0.9 s; profile shows no single JS function (layout/style in "(program)") | mail |

Not a large item: missing indexes. Every `active()` (`core/db/repo.ts`) filters all rows (no `deletedAt` index), and `_aiUsage.at` and `finance_transaction.date` are indexed but unused here; with seed `medium` the row counts (≤ 3 100 per click) cost less than the duplicate requests. A new index would need `npm run db:bump`; none is proposed for step 2.

Not seen: loading states longer than the data. The loading card (5) ends with the code; finance and overview are slow after it, not because of it.

## Order for step 2 (one PR per cause)

1. `fix/perf-start-bundle`: settings out of the start bundle (lazy route, offline navigation kept: precache holds the chunk; idle preload after start), dnd-kit out of Home's eager path, and tiny shared chunks merged; meet the existing budget instead of raising it.
2. `fix/perf-settings-reads`: one `useSettingsSections` per page (context), today's AI usage by the `at` index.
3. `fix/perf-attention`: the strip asks only its own modules; shared queries linger longer than 50 ms; Home mounts widgets without waiting for the strip.
4. `fix/perf-finance-render`: memoize the derived figures once per data change, month range where the view needs one.
5. `fix/perf-page-width`: read the rem size once per resize, not per render.

Finance and mail may need more than the two-day frame; if so they become a package of their own.

## Devices (hand test)

| | Windows (PF-K1 … K3) | Android (PF-K4 … K6) |
|---|---|---|
| finance 1st / 2nd | ☐ | ☐ |
| settings 1st / 2nd | ☐ | ☐ |
| overview | ☐ | ☐ |
| dialogs | ☐ | ☐ |

## Guard (step 3)

`web/e2e/seed/click-content.seed.spec.ts` (seed project, desktop and phone, ~4 min each): overview, settings, library, todos, calendar, finance and the todos/finance entry dialogs at CPU 4×, median of 3 runs of `done`. Targets agreed 2026-11-13: page ≤ 1.0 s on the first visit, ≤ 0.5 s on the second, entry dialog ≤ 0.3 s, each × 1.5 for CI load. Pages slower today have their measured value as `CEILING` in the spec: lower it when a fix lands, remove it at the target, never raise it. The probe is shared with `measure:click` (`web/e2e/perf/clickProbe.ts`).
