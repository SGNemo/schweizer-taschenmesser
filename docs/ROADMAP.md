# Roadmap – ideas, not commitments (2026-09-30)

Collected in the review round ([`archive/2026-10/REVIEW-2026-09-30.md`](archive/2026-10/REVIEW-2026-09-30.md)): what comparable everyday apps offer, what users ask for, and what the code already prepares. Nothing here is implemented; each idea lists benefit, effort (S = hours, M = days, L = a week or more), risk, dependencies and where it could collide with areas other sessions are working on.

**Merged while this roadmap was written (do not duplicate):** PR #8 (`feat/disk-cleaner-and-modules`, now on `develop`) added the modules *Datenträger* (desktop disk cleaner), *Zeiterfassung* (timetrack), *Vorräte* (pantry), *Geschenke* (gifts), *System* (desktop), the tools *text*, *timezones*, *image*, *pdf*, a `manifest.platforms` filter and `PlatformService.disk/system`. Its own idea list (vehicle log, colour and contrast, checksum and text diff, journal, warranty and receipts, clipboard history, snippets, autostart overview, WLAN QR, regex tester, grade and BMI calculators, bulk rename, medication and water, watchlist, cleaning plan, savings goals, travel, Android storage overview, sunburst view, scan cache, MFT quick scan) lives in `docs/STATUS.md`; it is referenced below, not repeated. The backup/sync hardening (PR #7) and quick capture (PR #6) are merged as well. Other sessions may still be working on follow-ups of these areas.

Sources: [to-do app comparisons 2026](https://blog.toodledo.com/toodledo-vs-things3), [top to-do apps](https://www.jotform.com/blog/apps-for-to-do-list/), [Actual Budget](https://selfhostyourself.com/services/actual-budget), [Firefly III vs Actual](https://beancount.io/blog/2026/07/26/firefly-iii-vs-actual-budget-self-hosted-open-source-budgeting-guide), [self-hosted Notion alternatives](https://thefrontkit.com/blogs/notion-alternatives-2026), [habit tracker features](https://affine.pro/blog/best-habit-tracker-apps), [password managers 2026](https://toolradar.com/guides/password-managers), [subscription trackers](https://www.getapp.com/all-software/a/trackmysubs/).

## Top 10 (priority order)
| # | Idea | Why first |
|---|---|---|
| 1 | **Widget-level "add" and inline edit on the dashboard** (K1) | The dashboard is the start page; today every action leaves it. Cheapest big win for daily use. |
| 2 | **Recurring tasks and "someday" list in ToDos** (M1) | The most requested to-do features in every comparison; the recurrence engine already exists (`core/recurrence`). |
| 3 | **Budget carry-over and category rules** (M3) | Envelope budgeting (Actual/YNAB) is the reference; finance + budgets already have the data. |
| 4 | **Calendar: drag to move, duration handles, ICS export** (M2) | Closes the gap to Google/Apple Calendar for the core module; export gives users a way out (local-first promise). |
| 5 | **Habit statistics: completion grid, best streak, per-weekday view** (M4) | Standard in every habit app; data is there, only views are missing. |
| 6 | **Vault: password health and breach check (k-anonymity)** (S1) | Baseline expectation for a password manager; zxcvbn is already bundled, HIBP range API keeps the hash local. |
| 7 | **Attachments in sync and backup** (K3) | Vault files and receipts are local-only today; users lose them on a second device. Large, but unblocks several modules. |
| 8 | **Home-screen widgets (Android) and tray quick actions (Windows)** (P1) | Turns Nemo from an app you open into one that is present; quick capture already has the hotkey and tray. |
| 9 | **Import from Google Tasks / Todoist / Bitwarden** (I2) | Switching cost is the main barrier to adoption; the importer framework and preview exist. |
| 10 | **Keyboard-first: global shortcuts sheet, `?` help, vim-like list navigation** (D1) | Frequent power-user request; the command palette already covers most actions. |

## Core (K)
| Id | Idea | Benefit | Effort | Risk | Depends on | Conflicts |
|---|---|---|---|---|---|---|
| K1 | Dashboard: add/complete/tick directly in widgets, per-widget size choice | Fewer navigations | M | low | `WidgetList` (done in this PR) | dashboard layout store |
| K2 | Global undo (toast "Rückgängig" for every delete/edit, 10 s) | Trust | M | medium (repo layer) | `createRepo` tombstones | sync ops (read-only for other sessions) |
| K3 | Attachments (`_blobs`) in sync and backup, size limits, dedupe by hash | Multi-device vault files, receipts | L | high (formats, encryption) | sync protocol version, server storage | **sync/backup owned by the dev chat – coordinate first** |
| K4 | Trash / restore for deleted records (tombstone browser) | Recover mistakes | M | low | tombstones exist | tombstone GC (not built) |
| K5 | Search filters (`typ:rechnung fällig:<7d`) and saved searches | Power users | M | low | `search/fulltext` | palette parser |
| K6 | Themes: high-contrast variant, font size setting, compact density | Accessibility | S–M | low | tokens (done) | none |
| K7 | Offline indicator and conflict list surfaced in the shell | Clarity during sync | S | low | `core/sync/conflicts` | sync UI |

## Modules (M)
| Id | Idea | Benefit | Effort | Risk | Depends on | Conflicts |
|---|---|---|---|---|---|---|
| M1 | ToDos: recurring tasks, someday/waiting lists, board view (columns = lists), task templates | Most requested | M | low | `core/recurrence` | PR #3 idea "board" (open) |
| M2 | Calendar: drag/resize in week/day, multi-day events, ICS export, week numbers, working-hours shading | Parity with calendar apps | M–L | medium (touch DnD) | dnd-kit present | external calendar sinks |
| M3 | Budgets: month carry-over, category auto-rules for imports, goal contributions from transactions | Envelope budgeting | M | low | finance public API | finance |
| M4 | Habits: year grid, per-weekday stats, best streak, skip-with-reason, quantity habits (glasses of water) | Motivation | M | low | – | PR #8 idea "medication and water" |
| M5 | Finance: split transactions, transfers between accounts, CSV/CAMT import mapping presets, net-worth chart | Bank-statement workflow | M–L | medium | `core/io` parsers | budgets |
| M6 | Invoices/Subscriptions: price-change history, "cancel by" reminder from notice period, yearly total | Unused-subscription insight | S–M | low | notifications | contracts |
| M7 | Notes: Markdown preview, checklists, backlinks, pin to dashboard | Notion/Obsidian basics | M | low | – | none |
| M8 | Contracts: document attachment, reminder before notice deadline | Completes the module | S (+K3 for files) | low | K3 | PR #8 "warranty and receipts" |
| M9 | Shopping: recipe → list, price memory, store sections | Daily use | M | low | pantry hand-over (PR #8) | **PR #8 pantry** |
| M10 | Journal / daily log with mood, prompts, month view | Popular companion to habits | M | low | – | PR #8 idea "journal" |

## Tools (T)
| Id | Idea | Benefit | Effort | Risk | Conflicts |
|---|---|---|---|---|---|
| T1 | Countdown to dates, world clock done (PR #8 timezones) → pick only: **regex tester, colour picker/contrast, checksum diff, text diff** | Already on the PR #8 idea list (`docs/STATUS.md`) – coordinate before starting | – | – | **PR #8** |
| T2 | Unit converter: currencies with offline cache date shown, cooking units | Small gap | S | low | currency tool |
| T3 | Stopwatch/Pomodoro linked to timetrack entries | Ties tools to a module | S | low | **PR #8 timetrack** |

## Integrations (I)
| Id | Idea | Benefit | Effort | Risk | Depends on | Conflicts |
|---|---|---|---|---|---|---|
| I1 | CalDAV/CardDAV read (Nextcloud, iCloud) | Common self-hosted stack | L | medium (auth, recurrence edge cases) | connector framework | ICS connector |
| I2 | Importers: Google Tasks, Todoist CSV, Bitwarden/1Password CSV (vault already has Bitwarden), Apple Reminders export | Switching cost | M | low | importer framework | – |
| I3 | Google Drive sync adapter (stub exists) | Sync without own server | L | high (OAuth on Android, quota) | `googleDrive.stub.ts` | **sync – coordinate** |
| I4 | Webhooks / Home Assistant: expose today's agenda and due items as read-only JSON over the local API | Smart-home dashboards | S–M | medium (scope of the local API) | local API tokens | local API security rules |
| I5 | Share-target on Android for files (PDF receipts) | Capture from other apps | M | medium | share-intent plugin | PR #8 pdf tool |

## Design / UX (D)
| Id | Idea | Benefit | Effort | Risk | Conflicts |
|---|---|---|---|---|---|
| D1 | Keyboard shortcuts sheet (`?`), `j/k` list navigation, `n` new | Power users | S–M | low | palette |
| D2 | Onboarding "first minute": sample data toggle with one-click removal | Empty app feels alive | S | low | setup assistant |
| D3 | Widget skeletons everywhere, optimistic UI for toggles | Perceived speed | S | low | done partly (WidgetList) |
| D4 | Per-module accent (subtle, from a fixed set) | Orientation | S | low: contrast test extension | tokens |
| D5 | Print styles (shopping list, packing list, month calendar) | Paper still exists | S | low | none |
| D6 | Reduced-data mode: hide amounts on the dashboard until tapped ("privacy blur") | Shoulder surfing | S | low | none |

## Security (S)
| Id | Idea | Benefit | Effort | Risk | Conflicts |
|---|---|---|---|---|---|
| S1 | Vault: password health (reused/weak via zxcvbn, already bundled), HIBP range check (k-anonymity, opt-in, via platform fetch), age | Baseline in 2026 | M | low | **crypto/vault – read-only for other sessions; UI only** |
| S2 | Passkeys storage (WebAuthn credential export/import format when browsers ship it) | Future-proof | L | high (spec in flux) | vault format |
| S3 | App lock (PIN/biometric) for the whole app, not only the vault | Often asked | M | medium (Android back-stack) | secure-store plugin |
| S4 | Emergency access / vault sharing via encrypted export with a second passphrase | Family use | M | medium | vault backup format (unchanged) |
| S5 | Signed release provenance (SLSA attestation, `gh attestation verify`) | Trust in downloads | S | low | release workflow (do not weaken) |
| S6 | Authenticode certificate or Azure Trusted Signing for the exe | SmartScreen | S (money) | low | Sven |

## Platform (P)
| Id | Idea | Benefit | Effort | Risk | Conflicts |
|---|---|---|---|---|---|
| P1 | Android home-screen widget (agenda, quick add), Windows tray quick actions | Presence | L | medium (Kotlin widget provider) | quick-capture tray |
| P2 | Linux/macOS builds of the shell (Tauri already cross-platform) | Reach | M | low | release workflow matrix |
| P3 | Android: share target for text already exists → add `nemo://` deep links (decide the scheme, see `docs/features/quick-capture.md`) | Automation | S | low | identifiers policy |
| P4 | PWA: periodic background sync, badging API for due counts | Web parity | S | low | service worker |
| P5 | ~~Point `latest.json` at `Nemo-Portable.exe`, drop legacy asset copies~~ – done (next release after v0.3.1); optional: drop the legacy names from `PORTABLE_ASSETS` / `APK_ASSET_PAIRS` | Cleanup | S | low | updater |
| P6 | `windows` crate 0.61 → 0.62 (removes a duplicate crate family), Tauri plugin bumps in step | Build size/time | S | medium (Windows API changes) | verify in CI only |

## Module review 2026-10-01 (decided, see `docs/product/`)
Target picture B and packages 1–7 are in [`product/MODULE-PLAN.md`](product/MODULE-PLAN.md); prompts in [`product/IMPLEMENTATION-PROMPT.md`](product/IMPLEMENTATION-PROMPT.md). Consequences for this list:
- **Scheduled as packages (no longer open ideas):** K1 (package 2), M1 recurring tasks + someday (5), M7 notes checklists + pinned scratch note (1), D1 tool routes/palette/shortcuts (1), S1 password health (7), T1/T3 settled (tools 18 → 12, timer stays separate).
- **Retired modules (data kept until package 6):** news, habits, timetrack; replaced by merges: reminders → calendar, shopping + packing → lists, launcher → bookmarks favourites, birthdays + gifts → people, contracts → vault ("Unterlagen"), system → disk ("Dieser PC").
- **Stay ideas without date:** K3 attachments in sync/backup (receipts, photos – wanted, but after Unterlagen), M2 calendar drag/resize, M3 budget carry-over, M4 habit statistics (module retired), M9 recipes → list, M10 journal, news as an optional extension, Timer ↔ timetrack (module retired), vehicle log, medication/water, cleaning plan.

## Explicitly not planned
- Cloud accounts, telemetry, ads. Nemo stays local-first with an optional self-hosted server.
- AI features that see user data (the assistant only sees schemas). A "summarise my notes" feature would break that rule; if ever, only with a local model and an explicit switch.
- FinTS/PSD2 bank connections: regulatory and maintenance burden, see `docs/STATUS.md`.

## Ideas moved from STATUS (2026-10-01, not built)
- Datenträger: Sunburst-Ansicht, „Letzten Scan zwischenspeichern“ (lokal, standardmäßig aus), MFT-Schnellscan mit Adminrechten, Ordner frei wählen (Dialog), Android-Speicherübersicht (belegt/frei, ohne Scan/Löschen), eigene Aufräum-Regeln.
- Module: Fahrzeug (Tanken, Verbrauch, TÜV/Service), Journal/Tagebuch, Garantie-/Belegverwaltung mit Foto, Zwischenablage-Verlauf (Passwörter ausschließen), Text-Snippets, Autostart-Übersicht (nur Anzeige), Medikamenten-/Wasser-Erinnerung, Watchlist/Leseliste, Putzplan, Sparziele (Haushaltsbuch), Reise (Packlisten, Reisedokumente, Zeitzonen), Speedtest/WLAN-Name (Systeminfo).
- Werkzeuge: Farbwähler/Kontrast-Check, Datei-Prüfsumme + Text-Diff, WLAN-QR, Regex-Tester, Notenrechner, BMI/Kalorien (ohne Speicherung), Massen-Umbenennen, Bild-Farben extrahieren, PDF komprimieren.
- Zeiterfassung: Stundensätze/Beträge, Projektfarben.
- **Build-/CI-Tempo (Runde `chore/build-performance`, nicht umgesetzt; Zahlen in [`perf/BUILD-BASELINE-2026-10-01.md`](perf/BUILD-BASELINE-2026-10-01.md)):**
  - Vitest ohne Testisolation (`--no-isolate`): lokal 222 s → 27 s, aber 5 Tests brauchen eine leere, gemeinsame Dexie-Datenbank je Datei. Möglich für die reinen Logik-Tests oder mit einem DB-Reset je Datei; gibt die Isolation je Datei auf – Entscheidung nötig.
  - Der größte Rest der Unit-Testzeit ist Import: `core/db/db.ts` zieht alle Manifeste, jede Testdatei wertet ~1200 Module neu aus (73 % der Zeit). Leichtere Test-Einstiege wären eine Architekturänderung.
  - `retries: 1` in beiden Playwright-Konfigurationen (CI) kann instabile Tests verdecken. In den ausgewerteten Läufen wurde kein Test wiederholt; Empfehlung: auf 0 setzen und Auffälligkeiten beheben (Entscheidung).
  - E2E nur auf `develop`/nächtlich mit kleiner PR-Auswahl: seit dem Sharding nicht nötig (PR-Lauf ~ 5 Minuten) und würde die PR-Abdeckung senken.
  - Android: die aarch64-Rust-Bibliothek wird zweimal gebaut (erst von `tauri android build`, dann von Gradle, je ~1 Minute). Ursache klären, z. B. mit `cargo build -vv` die Fingerprints vergleichen.
  - `beforeBuildCommand: npm run build` führt im Windows- und Android-Job den Typecheck erneut aus (25–40 s). Bewusst belassen, damit Tag-Builds nie ohne Typprüfung entstehen.
  - Release-Profil (fat LTO, `opt-level = "s"`) macht den Windows-Build zu 7 Minuten. Eine Änderung würde das Artefakt verändern; ein schnelleres Profil nur für Trockenläufe würde nicht mehr das echte Artefakt prüfen.
  - Läufe von Feature-Branches starten ohne Rust-/Gradle-Cache (Cache-Scope je Branch): Trockenlauf des Release-Workflows besser von `develop` aus starten.
  - Rust `[profile.dev] debug = "line-tables-only"`: ~ 20 % kleineres `target`, aber keine Zeitersparnis bei den kleinen Crates und Debugger ohne Variablen – nicht gesetzt. Außerdem: apt-Cache-Action für die Tauri-Bibliotheken (~ 30 s, neue Abhängigkeit) und eine kürzere Paketliste, jeweils erst messen.

## Android Autofill service for the vault (planned follow-up PR, not built)
Feasibility note (2026-10). Until it exists: copy with the sensitive clipboard; entries saved through the browser extension arrive by the normal sync.
- **Approach:** a native `AutofillService` (Kotlin) in the existing `secure-store` plugin context (`web/src-tauri/plugins/`), declared in the generated Android manifest (the release workflow copies native files after `tauri android init`). It answers `onFillRequest` with datasets only while the vault is unlocked and asks for biometrics through the existing `BiometricPrompt` path; the user picks the system's autofill service in Android settings.
- **Data access:** the service must not hold a copy of the vault. Options: (a) the WebView app is the only decryptor and the service asks it through a bound service/IPC (fragile when the app is not running), (b) the DEK stays sealed in the Android keystore (already used for biometric unlock) and the service decrypts entries read from the same IndexedDB/SQLite store – needs a native reader for the encrypted entry format (`modules/accounts` AES-GCM, AAD `vaultId/entryId/1`) and for the Dexie storage. (b) is the realistic one; it needs a small Kotlin port of `core/crypto/aead.ts` plus test vectors shared with TypeScript.
- **Matching:** reuse the origin rules of `packages/vault-core/src/origin.ts` (domain vs host); Android gives `webDomain` or the app's package, so app-to-site links (Digital Asset Links) are out of scope for the first version (web fields only).
- **Risks:** Play/OEM autofill quirks, `FLAG_SECURE`/screenshot protection interplay, a second implementation of the vault format that must stay in step (contract tests), time-to-first-fill when the process was killed, saving new logins (`onSaveRequest`) would add a write path that must go through the same sync rules.
- **Effort:** roughly two PRs – (1) native decrypt + unlock + fill for web fields, (2) save/update and polish. Not started; needs a decision on option (b) first.
