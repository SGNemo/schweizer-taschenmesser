# Backlog harvest – 2026-11-03

Branch `chore/backlog-harvest-2026-11`, base `develop` @ e16729b. Read-only harvest, no code changed. Method: three parallel read passes (ROADMAP/STATUS/meta/security/perf · product/QA · scribble/TODOs), the last ~200 merged PR bodies (sections Open / Not done / Next / Follow-up), open issues (none; the only open items are PRs), then a code check per candidate. Items marked *unverified* were not run (no `node_modules`, no app start); "open" means no trace of a fix was found in code.

Findings in short: there are **no TODO/FIXME/HACK markers** in code (only fixtures and one scaffold template). `docs/qa` findings are older than ~40 commits; most UI items there are not rechecked. Several "open" claims in older docs are already done (listed under *Already done*).

Legend: Eff S/M/L · Value L/M/H · UI = needs visible markup, styles or components.

## 1. Proposal – 10 non-UI items (you choose)

Selection rules: no UI, no schema change or hotspot contract, outside identity-v3 and the open map/settings/money files, testable, none of the protected areas (signing, secrets, gitleaks, artifact audit, sync encryption, crypto/vault, screenshot protection).

| # | Item | Why | Files | Test | Eff | Val | Overlap risk |
|---|---|---|---|---|---|---|---|
| P1 | **Backup import hardening (V5):** size cap before parse (64 MB), skip rows with wrong envelope types and report the count | LAUNCH-REVIEW V5 is the one medium security item still open: `rowSchema` is `z.looseObject`, no size cap anywhere | `core/backup/{backup,apply}.ts`, `hardening.test.ts` | Vitest: oversize file, row with `updatedAt: 5`, skipped-count | M | H | low. Only envelope-level validation (no per-collection schema import, to avoid module imports in core). Preview text for the count would be a UI string → I would only return the count and let the existing result line show it, or add one string in 5 languages |
| P2 | **CSV formula neutralisation (V10):** prefix cells that start with `= + - @ TAB CR` in `toCsv` | spreadsheet injection from imported bank/payee text; one function | `core/io/csv.ts`, `core/io/csv.test.ts`; callers `modules/finance/export.ts`, `modules/accounts/csv.ts` | Vitest incl. round trip | S | H | low. **Decision needed:** the vault export is deliberately Bitwarden-compatible; I would neutralise everywhere except the accounts export, or make it an option there |
| P3 | **Server error handler (N11):** `setErrorHandler`, generic body for unexpected errors, no `error.message` leak | LAUNCH-REVIEW N11; ~10 lines | `server/src/app.ts`, `server/test/` | Fastify inject: throwing route returns generic 500 | S | M | low (server not in any open branch). CORS `*` stays (self-hosted default; note only) |
| P4 | **Notification limits with Stumm (mute):** repeats dropped by mute must not count toward the hour cap nor fold into another reminder's summary | scribble `test-notification-limits.md`; wrong reminders/summary, a pinned behaviour test exists | `core/notifications/policy.ts`, `policy.test.ts`, `limits.test.ts` | Vitest, extend limits cases | M | M | low |
| P5 | **Notice period "month = 30 days":** compute the cancel deadline in calendar months instead of a fixed 30 days | legal-deadline risk (BOARD 10-31, #296): "3 Monate" can land on the wrong date | `core/deadline/notice.ts`, `modules/subscriptions/logic.ts` (+ `vault`, `core/mail/heuristics.ts` users of `noticeDays`) | Vitest: Jan 31 + 1 month, 3 months over year end | M | H | **needs your decision:** stored value stays days (no migration), so the unit would have to be kept next to it (schema change) or "months" stays a UI convenience. Safe variant without schema change: keep days but document and show the resulting date; I recommend P5-lite = show the computed date + test, full fix later with a migration |
| P6 | **Flaky/failing e2e root causes:** `calendar-drag.spec.ts:55` (13:45 vs 14:00), `seed/seed.spec.ts:49` (weather/music empty states), `extras.spec.ts:177` (`ERR_ABORTED` after save) | red or flaky on `develop`, hides real regressions; fix the cause, never weaken the assertion | `e2e/calendar-drag.spec.ts`, `e2e/seed/seed.spec.ts` (+ seed if needed), `e2e/extras.spec.ts` | `--repeat-each=10` before/after | S–M | M | low–medium (`extras.spec.ts`: money-followups branch may touch it) |
| P7 | **`logError(tag, e)` helper** and use it for the silent `.catch(() => undefined)` calls in non-protected code (81 occurrences; I would take ResumeTracker, tools/qr, quickCapture, useOpenParam, coverTone) | IMPROVEMENTS Top10-2, ROADMAP "Not chosen" #40; failures become visible in the redacted diagnostics log | new `core/diagnostics/logError.ts` (reuses `errorLog.ts`), the listed files | Vitest: scrub test (negative list) + helper | M | M | low. Not touching sync, localapi, vault bridge |
| P8 | **CI: Android manifest assertion (T2)** (`allowBackup=false`, `usesCleartextTraffic=false` after `tauri android init`) **and the site deploy-hook `if` (P13)** | LAUNCH-REVIEW T2/P13: hardening is not enforced; the hook step probably never runs (step-level `env` in its own `if`) | `.github/workflows/{release,dev-preview}.yml` | dry run of the check script locally against a sample manifest; workflow lint | S | M | low; **release.yml is sensitive**: I only add a check step and move the hook condition, no signing/steps touched. Say no if you do not want any edit there |
| P9 | **Barcode scan:** use `BarcodeDetector.getSupportedFormats()`; Android `CAMERA` permission | #314 review leftovers; scanning fails silently on devices without the formats/permission | `modules/pantry/components/ScanDialog.tsx`, `tools/qr/View.tsx` (logic only), `src-tauri/plugins/share-intent/android/**` | Vitest for the format-selection helper; manual test on Android | M | M | low; **hardware test open** → MANUAL-TESTS |
| P10 | **Repo guard for case-insensitive file collisions** (a Linux CI check that fails when two paths differ only in case) | #369: Windows build broke because of it | new `web/scripts/check-case-collisions.mjs` (+ test in `scripts/lib`), `web/package.json`, CI step in `ci.yml` | script test with fixtures | S | M | low (`package.json` scripts: separate small commit) |

Reserve (if you drop some): ScanPage store selectors (`modules/disk/routes/ScanPage.tsx:11`, S, perf) · calendar subscription check timeout (B26, `modules/calendar/external.ts`, S–M) · `MS_PER_DAY` constant (S) · `http://` warning for non-local sync address (V23, `selfHosted.ts`, S, has a string) · sync counter fix (B30) · `docs/user/modules.md(.de.md)` claims "no share target on Android" (S, docs) · Spotify/air data-flow rows in README/site (S, docs/legal).

Recommendation: P1, P2, P3, P4, P6, P7, P8, P10 (+ P5-lite). P9 needs a device; P5 full needs a schema decision.

## 2. UI items for the module chats (hand-over, nothing done here)

| Source | Item |
|---|---|
| QA B03, #408 | Narrow header: search oval and calendar switch cut off (AppShell; identity-v3) |
| QA B01/V19 | Shopping list: double checkbox, checked items jump to the end, whole-row tap (lists) |
| QA B10 / known-open D1 | FAB covers fields on mobile |
| QA B02, B11, B14, B20 | Welcome card, toast stacking, truncated text, ToDos desktop column too narrow |
| QA V01, B04–B06 | 3-question setup path, progress numbers, greyed "Weiter", profiles silently disable modules |
| QA V02, V07, V11, B13, B15, B17, B29 | Wording, language leftovers, README "German today", AI buttons only with AI on |
| known-open K1–K20 (comfort) | Tappable home rows, palette verbs, in-row price edit, filter chips, copy icon, calendar slot tap, bulk move, list chips, timer presets, gear in dialogs |
| QA V04 | Flexible recurrence UI (engine has it, editor lacks interval/weekdays/end) |
| QA B31 | Multi-day night shift shows only the start time |
| scribble feat-mail-read | axe `label-content-name-mismatch` on every `GroupedList` toggle (`ui/GroupedList.tsx`) |
| scribble feat-phone-one-hand | `askAfterTyping` only on 3 editors; Back in setup closes the whole assistant |
| scribble feat-focus2-reminders-tab | Rows still show "Einmalig · …" from `describeRecurrence` |
| scribble charming-volta | "Erweitert" not in a menu on calendar, finance, invoices, subscriptions, pantry, people |
| scribble settings folds | Settings page ~4400 px on the phone; start-data row 13× (settings chat) |
| scribble feat-weather-* | Pollen type choice, "bad pollen day" line, per-day "feels like" chart |
| #413 | Current value in settings search hit; more fields switchable (allow-list review) |
| #391 | Calendar: drag-create, multiple calendars, several reminders per event, weather per day |
| #378 | Rename a note page → update `[[links]]`; PDF on Android |
| #307 | Quick capture does not set the person; colour per person |
| #314 | JS QR decoder for browsers without `BarcodeDetector` (new dependency) |
| MANUAL-TESTS N7 | Chart colours not re-validated for colour-blind users |
| `check:stimulus` | `desktop--lists · buttons` 75/74 on develop (lists page) |

## 3. Full table of findings

Source | Item | Type | UI | Eff | Val | Status. Proposal ids in brackets.

### Security and hardening
| Source | Item | Type | UI | Eff | Val | Status |
|---|---|---|---|---|---|---|
| LAUNCH-REVIEW V5 | Backup import: loose rows, no size cap [P1] | bug | no | M | H | open |
| LAUNCH-REVIEW V10 | CSV export without formula neutralisation [P2] | bug | no | S | H | open |
| LAUNCH-REVIEW N11 | Server without `setErrorHandler` [P3] | bug | no | S | M | open |
| LAUNCH-REVIEW N9 | Compose publishes on all interfaces, CORS `*`, base image by tag | improvement | no | S | L | open (documented default) |
| LAUNCH-REVIEW N12 | Server skips ops of unknown collections while the cursor advances | bug | no | S–M | L | unverified |
| LAUNCH-REVIEW T2 | CI assertion for Android manifest flags [P8] | improvement | no | S | M | open |
| LAUNCH-REVIEW P13 | Site deploy hook `if` on step-level env [P8] | bug | no | S | M | open (verify in a run log) |
| LAUNCH-REVIEW P4/P5 | Unpinned `choco install vulkan-sdk`, no rust-toolchain.toml, no provenance attestation | improvement | no | S–M | L | open |
| LAUNCH-REVIEW V4 | Android clipboard lacks the sensitive flag | bug | no | S–M | M | open (Kotlin plugin, hardware) |
| LAUNCH-REVIEW X2 | Windows pipe: first-instance flag cleared in `accept()` (`vault-bridge/ipc.rs:247`) | bug | no | M | M | open (crypto/vault bridge area, Windows test) – **excluded** |
| LAUNCH-REVIEW X4 | Extension overlay host can be hidden by page script | bug | yes | M | L | open – extension |
| LAUNCH-REVIEW A5 | Local model file not re-hashed at `llm_load` | improvement | no | M | L | open |
| LAUNCH-REVIEW T5 | OAuth loopback listener: one connection at a time, 5 s read timeout | bug | no | S | L | open |
| LAUNCH-REVIEW V9 | Vault has no rollback counter | bug | no | S | M | open – **excluded (vault/crypto)** |
| LAUNCH-REVIEW V2 | Windows Hello only a consent gate; DEK readable in Credential Manager | improvement | no | L | M | documented limit – **excluded** |
| AUDIT S5/S13 | Sync token in `_secrets.syncConfig`, APK digest signature missing | techdebt | no | M | M | unverified – **excluded (secrets/sync)** |
| LAUNCH-REVIEW P2 | Second dev signing key (maintainer action) | improvement | no | M | M | maintainer – **excluded (signing)** |
| QA V23 | `http://` warning for non-local sync address | improvement | partly | S | L | open (reserve) |

### Logic and bugs
| Source | Item | Type | UI | Eff | Val | Status |
|---|---|---|---|---|---|---|
| BOARD 10-31 (#296) | Notice "month" = 30 days (`core/deadline/notice.ts`) [P5] | bug | no | M | H | open |
| scribble test-notification-limits | Mute-dropped repeats count toward hour cap [P4] | bug | no | M | M | open |
| BOARD 10-31 (#314) | `getSupportedFormats()` unused, Android CAMERA permission missing [P9] | bug | no | M | M | open |
| QA B26 | Calendar subscription "Wird geprüft …" never ends | bug | no | S–M | M | open (reserve) |
| QA B30 | Sync counters show 0 received; misleading "older version" line | bug | partly | S | L | open |
| QA B19/V05 | Reminders with closed PWA need push; save-time tip | bug | partly | M | H | unverified |
| QA B12 | Quick-capture mis-parses ("Freitag 12 Uhr abgeben", "nächsten Freitag") | bug | no | M | H | partly done (parser has endtime/amount/recurrence); remaining sentences unverified |
| QA B28 | Bank import drops payee; "Mit KI eintragen" merges two transactions | bug | partly | M | M | partly done |
| #322 | Finance default account/categories always German | bug | no | M | L | open – needs own decision |
| #315 | Entry moved to another list leaves the share scope; receiver cannot tell | bug | no | M | L | open |
| #294 | "Jetzt wichtig" and agenda can list the same reminder twice | bug | no | S | L | open (product call) |
| #356 | Downloads from the browser carry no cookies | bug | no | M | L | open |
| #375 | `librqbit` UDP tracker binds `[::]`, engine fails without IPv6 | bug | no | L | L | open (upstream) |
| #380, #371 | `extras.spec.ts` `page.goto` `ERR_ABORTED` race [P6] | techdebt (test) | no | S | M | open |
| BOARD parking | `calendar-drag.spec.ts:55` 13:45 vs 14:00 [P6] | bug (test) | no | S | M | open |
| BOARD parking | `e2e/seed/seed.spec.ts:49` weather/music empty states [P6] | bug (test) | no | S | M | open |
| BOARD parking | Sync e2e "server sees only ciphertext": first encrypted connect not "Synchronisiert" in 5 s | bug | no | M | H | open – may be a real sync regression, needs analysis first |
| BOARD parking | `layout.spec.ts` month grid: `boundingBox()` null after `toBeVisible` | techdebt (test) | no | S | L | open |
| CLEANUP Q11 | `reminders.spec.ts:89`, `newmodules.spec.ts:42` flaky under load | bug (test) | no | S–M | M | unverified |
| IMPROVEMENTS Q10 | `calendar/settings.ts` own `TIME` regex instead of `TIME_RE`; hidden load-order cause (CI-only break) | bug (latent) | no | S–M | M | open |
| BOARD 10-30 | Review leftovers #290 (wording, toast count, `save()` catch), #294, #288, #287 | techdebt | no | M | M | unverified |

### Tech debt, CI, performance
| Source | Item | Type | UI | Eff | Val | Status |
|---|---|---|---|---|---|---|
| IMPROVEMENTS Top10-2 / ROADMAP #40 | `logError` instead of 81 silent catches [P7] | techdebt | no | M | M | open |
| #369 | Case-insensitive file collision guard [P10] | techdebt | no | S | M | open |
| IMPROVEMENTS Top10-1 | `as unknown as` in `core/db/repo.ts` (8), `tx.ts` (1) | techdebt | no | M | L | open (hotspot-ish) |
| IMPROVEMENTS Top10-3 | `EditorActions` base component for the editor footer | techdebt | yes | M | M | open |
| IMPROVEMENTS Top10-4 | Split `buildApp` in `server/src/app.ts` into route plugins | techdebt | no | M | L | open |
| IMPROVEMENTS Top10-5/6 | Split `ScanView.tsx` (~747 lines), `OnboardingWizard.tsx` (~602) | techdebt | no | M | L | open |
| IMPROVEMENTS Top10-7 | ESLint `complexity`/`max-lines-per-function` as warnings | techdebt | no | S | L | open |
| IMPROVEMENTS Top10-8 | `ScanPage` subscribes to the whole store | perf | no | S | M | open (reserve) |
| IMPROVEMENTS Top10-9 | Shared hex/base64 helpers (5 + 4 copies) | techdebt | no | S–M | L | open (sync/vault copies excluded) |
| IMPROVEMENTS Top10-10 | `MS_PER_DAY` and one push window constant (~12 files) | techdebt | no | S | L | open (reserve) |
| IMPROVEMENTS Q12 / ROADMAP #38 | Test speed: `resetDb` helper, Vitest `isolate:false` for pure logic (237 s) | perf | no | S–M | M | open |
| IMPROVEMENTS Tests | Playwright `retries: 1` hides flakiness | improvement | no | S | M | open (product decision; first fix P6) |
| IMPROVEMENTS Hygiene | Root `package.json` is `{}` and root lockfile empty; `@nemo/vault-core` alias in 5 configs | techdebt | no | S–M | L | open |
| IMPROVEMENTS Hygiene | `.dockerignore` minimal; proxy UA `Taschenmesser-Proxy/1`; Inter via `node_modules` path in `global.css`; playwright configs location | techdebt | no | S | L | open |
| IMPROVEMENTS Code structure | `Date.now()` in `claude.ts:102`, `backup/verify.ts:64`; central `Window` augmentation | techdebt | no | S | L | open |
| IMPROVEMENTS Q15 | No coverage tooling | techdebt | no | S | L | open |
| CLEANUP Q14 | "Checked, unclear" dead code: `FRONT_WIDGETS`, `LEGACY_HASHES`, `DEFAULT_FOCUS`, `SETUP_STATUSES`, `googleDrive.stub.ts`, `PageContainer .full` | techdebt | no | S | L | open |
| scribble feat-calculator-modes | `check:docs` fails on `docs/qa/*/REPORT.md` budgets | techdebt | no | S | M | unverified |
| COLD-START | `SortableList`/@dnd-kit via `ui/index.ts` on critical path (~25 KB), OnboardingWizard (~17 KB), qrcode (~13 KB), @noble (~14 KB), all locale catalogues precached | perf | no | S–M | M | open – `ui/index.ts` is base-component territory (identity-v3) |
| ROADMAP | `windows` crate 0.61 → 0.62; legacy asset names; Android aarch64 Rust library built twice | techdebt | no | S | L | open |
| scribble chore-stimulus-budget | No "ratchet down" mode for the stimulus baseline | idea | no | S | L | open (deliberate) |
| `inventory.test.ts` | Snapshot had a `habits` entry the registry does not produce | bug (test) | no | S | M | probably done with #404; run to confirm |

### Docs and legal
| Source | Item | Type | UI | Eff | Val | Status |
|---|---|---|---|---|---|---|
| scribble eager-lovelace | `docs/user/modules.md` (+ `.de.md`) says Android has no share target; `share-intent` plugin exists | bug (docs) | no | S | L | open |
| #318 | "no tombstone GC" stale in `docs/architecture/sync-backup.md:14`, `docs/decisions/core.md:19` (`purgeTombstones` runs after 90 days) | techdebt (docs) | no | S | L | open |
| scribble feat-connector-spotify, BOARD #305 | Spotify data flow not on website privacy page/README; air host in DATA-FLOWS | improvement | no | S | M | unverified |
| scribble feat-gaming-quiet-reminders | `docs/decisions/focus.md`: "OS toast sound cannot be silenced" probably outdated | techdebt (docs) | no | S | L | open |
| IMPROVEMENTS | Docs name a test file count (258 vs 236) instead of the command | techdebt | no | S | L | open |

### Ideas (not planned, for the maintainer)
Attachments (`_blobs`) in sync/backup (L, H) · LAN/QR pairing without server (L, H) · Android Autofill service (L, H, decision pending) · backup to a user-chosen folder (S, M) · HIBP k-anonymity password check (M, H; vault area) · web build without native shell (L, H) · Takeout ZIP, Todoist/Keep/Obsidian import extras · AI actions for budgets (needs core change) · local model profile "Leicht" · Spotify playlist edit scope · regex saving · Rust screen capture if `getDisplayMedia` fails in WebView2 · map follow-ups (typing suggestions, house numbers, departure time, PMTiles range per leaf run: map branches in flight).

## 4. Already done (checked in code, recommend closing in source docs)
- Command palette lazy in `AppShell.tsx:47` (perf notes, scribble perf-bundle-findings).
- `applyLimit` buckets by local hour (`core/notifications/policy.ts:137`).
- `dependsOn` on `ImportCandidate` (`core/importer/batches.ts:38-41`); BOARD line can be ticked.
- Trash "Zuletzt gelöscht" (`core/db/trash.ts`), budget carry-over (#409), subscription price hint (`finance/attention.ts`), missed cancellation deadline, undo for document delete, search history setting (`core/search/recent.ts`), plain backup checksum, weak master password confirmation, connection log (`core/net/netlog.ts`).
- `chats-status.mjs` merge-base crash, weather hours toggle, OSM user agent (`modules/maps/agent.ts`).

## 5. Not verified
Rust/Android security items (X2, X4, V2, V4, A5), most QA UI items, Spotify/Open-Meteo browser CORS (hand tests S6/S7), the sync e2e ciphertext timeout (not rerun), `check:stimulus` numbers. Nothing was run because `node_modules` is not installed in this container; Phase 2 starts with `npm ci`.
