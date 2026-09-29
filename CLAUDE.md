# CLAUDE.md – Taschenmesser

Modular, local-first everyday PWA ("Swiss army knife"): Windows desktop (Chrome/Edge) + Android Chrome, installed as PWA.
Data lives in IndexedDB; sync is a separate optional layer; an AI search answers questions with as few tokens as possible.
Code, comments and commits are **English**; the UI is **German only** (all texts in `web/src/strings.ts`).

Full architecture plan: approved in the first session (phases below). Keep this file current when decisions change.

## Repo layout
- `web/` – the PWA (Vite, React 19, TypeScript strict). Own `package.json`.
- `server/` – sync server (Fastify + SQLite). **Phase 4, not started.** Separate project, no shared package.

## Commands (run in `web/`)
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run preview` | Production build / serve on :4173 |
| `npm run typecheck` | tsc for app, service worker, node configs |
| `npm run lint` | ESLint (incl. module isolation rules) |
| `npm test` | Vitest unit + component tests |
| `npm run e2e` | Playwright, projects `desktop-chrome` + `pixel-7` (builds with `--mode e2e`) |
| `npm run gen:module -- <id> "<Name>"` | Generate a new module from `templates/module` |
| `npm run db:bump` | Regenerate `src/core/db/schema.snapshot.json` + bump Dexie version |
| `npm run gen:icons` | Re-render PWA PNG icons from `public/icon.svg` |

Definition of done for every phase: `lint`, `typecheck`, `test`, `e2e` green; app starts; CLAUDE.md updated; commit + push to `develop`.

Sandbox note: a Chromium is pre-installed at `/opt/pw-browsers/chromium`; `playwright.config.ts` and `gen-icons.mjs` pick it up automatically (override with `PW_CHROMIUM_PATH`). Never run `playwright install` there.

## Architecture decisions
**Modules.** Each module is `web/src/modules/<id>/` with a `manifest.ts` (`ModuleManifest`, see `core/modules/types.ts`). Manifests are discovered with `import.meta.glob` (eager, tiny); routes and widgets are `import()`-lazy. State (enabled/disabled) is in the synced `_modules` table; without an explicit choice `defaultEnabled` applies. Disabling asks: keep data (hidden) or delete (tombstones, so the deletion syncs). `devOnly` modules (the `example` module) are only listed in dev builds / with `VITE_INCLUDE_EXAMPLE=true` (`.env.e2e`).

**Isolation.** Modules never import each other (enforced by ESLint `no-restricted-imports` and by `registry.test.ts`, which scans the source). They communicate via
- the typed **event bus** (`core/events`, catalogue in `events.ts`),
- **manifest contributions** (`contributions.quickAdd`, `calendarItems`, `notifications`; loaders are lazy `() => import()` so manifests stay free of DB imports; collected by `core/modules/contributions.ts`),
- the single exception: `finance` may import `subscriptions/public.ts` and `invoices/public.ts` (read-only).

**Data.** One Dexie table per collection, named `<moduleId>_<collection>`; system tables `_meta`, `_outbox`, `_secrets` (local only) and `_settings`, `_modules` (synced). Table schemas are derived from all manifests (`core/db/schema.ts`); `schema.snapshot.json` holds the committed Dexie version + stores and a test fails when they drift → run `npm run db:bump`.
- IDs: `crypto.randomUUID()`. Money: integer minor units. Date-only values: `'YYYY-MM-DD'` strings, times of day `'HH:mm'` (local wall clock – calendar events and reminders use date + time strings instead of epoch ms so they stay put across timezones and recurrence works on plain dates); epoch ms only for technical timestamps (`createdAt`, `completedAt`, notification `at`).
- **Every synced record carries an envelope**: `id, createdAt, updatedAt, deviceId, deletedAt (tombstone), _f` (per-field HLC stamps → field-level last-write-wins).
- **Writes only via `createRepo(table, zodSchema)`** (`core/db/repo.ts`): validates, stamps changed fields with an HLC (`core/db/hlc.ts`), soft-deletes, queues into `_outbox`. Modules must not import `@/core/db/db` (ESLint). Reads: `repo.active()` (live records) / `repo.table` (read-only view, includes tombstones) with `useLiveQuery`.
- Inside Dexie transactions never await non-Dexie promises; keep row builders pure (see `repo.ts`).
- Module data migrations: `manifest.migrations[toVersion]`, run by `core/modules/migrate.ts`; installed version is device-local (`_meta`).
- Time: use `now()` / `today()` from `core/time/now.ts` (injectable in tests), never `Date.now()` in logic.

**Shared building blocks (Phase 2).**
- `core/recurrence`: Zod `recurrenceSchema` (`freq, interval, byWeekday (ISO 1=Mon), byMonthDay (1–31 or -1), monthOfYear, until, count`), `occurrencesBetween / nextOccurrence / firstOnOrAfter / datesInRange` on `'YYYY-MM-DD'` strings, "every 31st" clamps to month end, `describeRecurrence()` (German) and `<RecurrenceEditor>` for forms. Editing a recurring item changes all occurrences (no per-occurrence exceptions yet).
- `core/time/dates.ts`: string-date helpers (`addDaysStr`, `formatDay` with the German locale, `toEpoch`, …).
- `CalendarItem` (in `core/modules/types.ts`): every module can put items on the calendar via `contributions.calendarItems`; the calendar module never imports other modules. `useCalendarItems(range)` is live.
- `core/notifications`: `NotificationService` interface + local implementation (uses `registration.showNotification`, falls back to `new Notification`). `startNotificationScheduler()` (started in `main.tsx`) checks every 30 s / on visibility for notifications in `(cursor, now]` from `contributions.notifications`, cursor in local `_meta.notifyCursor`, catch-up limited to 24 h, dedupe through the notification `tag`. Works while the app is open only.
- Dashboard: `pages/dashboard/` – widgets from active manifests, order/hidden in synced `_settings` scope `dashboard` (`layout.ts` is pure and unit-tested), dnd-kit with keyboard sensor and German announcements. `ModuleManifest.order` sorts navigation, library and default widget order.

**Money & finance (Phase 3).**
- Money is integer cents everywhere (`core/money.ts`: `formatMoney`, `parseMoney` for "12,50" / "1.234,56", `formatMoneyInput`); one currency (EUR) app-wide for now. Forms keep the amount as text and parse on submit.
- **Invoices → finance without importing each other:** `invoices/actions.ts` emits `invoice.paid` / `invoice.unpaid` on the bus. Finance runs a *module service* (`contributions.services`, started/stopped by `core/modules/services.ts` for exactly the enabled modules) that books the expense with the deterministic id `inv-<invoiceId>` (idempotent, convergent across devices, restores a tombstone; a re-announcement after editing a paid invoice only updates amount/date/payee/note and keeps the user's account/category). Reopening removes the expense. Paying while finance is disabled books nothing (not reconciled later). Deleting an invoice keeps its expense.
- **Sanctioned cross-read:** `finance/summary.ts` imports only `invoices/public.ts` (`listOpenInvoices`, `sumOpenInvoices`) and `subscriptions/public.ts` (`listSubscriptionCharges`, `subscriptionTotals`); ESLint (regex allowlist) and `registry.test.ts` enforce this. Data of disabled modules is never read (checked via `useModuleStates`).
- **Available money** = balance (bookings up to today) − open invoices − subscription charges until month end (each part switchable in the finance settings, only counted when that module is enabled). The hero figure shows "Verfügbar" only when something is actually deducted, otherwise "Kontostand".
- **Subscriptions are forecasts, not bookings:** they are never turned into transactions automatically. Cost per month/year is normalised from the recurrence (`chargesPerYear`), rounded once at the end. Cancellation deadline = next charge − `cancelNoticeDays`; shown on the calendar (kind `cancel`) and as a notification (`cancelRemindDaysBefore`, 09:00).
- Finance seeds a default account (`acc-main`) and categories with fixed ids once (flag in the synced settings scope `module.finance`); the invoice category is `cat-invoices`. The first account (by `order`) receives automatic bookings.
- **Charts** (`finance/components/Charts.tsx`, Recharts, lazy chunk only loaded on the overview) follow the dataviz skill: nominal categories → one colour for all bars (sorted, value at the bar tip, ≤ 24 px, 4 px rounded data end); two series → tokens `--viz-1` (blue) / `--viz-2` (orange) from `ui/tokens.css`, validated with the skill's `validate_palette.js` against our surfaces (light `#ffffff`, dark `#1d1f22`, both PASS); legend above, grouped columns with 2 px gap, hairline solid grid, text in text tokens, tooltip with line key + value first, and a **table twin** for every chart (toggle button). Re-validate if `--surface` or the viz tokens change.

**State.** Data = Dexie + `useLiveQuery`. Zustand (`stores/ui.ts`) = UI-only state (theme, palette, quick add, toasts). Theme lives in `localStorage` + inline script in `index.html` (no flash).

**UI.** CSS Modules + tokens (`ui/tokens.css`), light/dark, `prefers-reduced-motion` respected. Primitives in `web/src/ui` (Button, Dialog on native `<dialog>`, Fields, Card, Toaster…). Icons: `lucide-react` via `ui/icons.tsx` (`IconName`). Sidebar ≥ 900 px, bottom nav below, quick-add FAB, command palette (Ctrl+K). Touch targets ≥ 44 px, visible focus. Dialog autofocus: use `data-autofocus` (React `autoFocus` runs before `showModal()`).

**PWA.** `vite-plugin-pwa` with `injectManifest` (`src/sw.ts`), update prompt via toast. Android Chrome has no `new Notification()` → notifications must go through `registration.showNotification`.

**Planned (not built yet)** – see phase plan:
- Sync: field-operation store. Server keeps `(collection,id,field) → (hlc,value,seq)` and accepts an upsert only if the HLC is greater; merge logic lives only in the client. Optional per-field AES-GCM encryption (PBKDF2 key from passphrase). Token auth. Server also serves the PWA (HTTPS via `tailscale serve`).
- AI: one Zod `Query` format for stage 1 (local German intent parser + full-text) and stage 2 (LLM tool call with only question + date + compact `aiSchema`s, no user data). Executor validates against `aiSchema`, runs locally. `AiProvider` interface (Claude Haiku default, Ollama). Cache the structured query, show token usage. Creating entries always needs a confirmation dialog.
- Notifications: local first (`NotificationService`), Web Push in phase 6 as option.

## Create a new module
1. `npm run gen:module -- habits "Habit-Tracker"` (id: lowercase alphanumeric). This copies `templates/module`, fills placeholders and runs `db:bump`.
2. Edit in `src/modules/habits/`: `schema.ts` (Zod data), `repo.ts` (`createRepo`), `ai.ts` (compact AI schema; `titleField` must be a field), `settings.ts`, `routes/`, `widgets/`, `migrations.ts`, manifest `icon`/`description`/`defaultEnabled`.
3. Route paths must start with `/<id>`; add `nav: true` for navigation entries; add `contributions.quickAdd` for the FAB.
4. Add UI strings to `src/strings.ts` (German).
5. If you change collections/indexes later: `npm run db:bump`. If you change stored data shape: bump `manifest.version` and add a migration.
6. Run `npm run lint && npm run typecheck && npm test`; add an E2E case for user-visible flows.

## Phase plan & status
1. **Foundation** – done: PWA shell, design system, layout, module registry/library, Dexie core (envelope, HLC, repo, outbox), event bus, settings, generator, example module, tests + E2E.
2. **Core modules** – done: `core/recurrence`, ToDo (lists, priority, due date, subtasks), Reminders (recurrence + local notifications), Calendar (month/week/day, aggregates other modules; week/day are agenda lists, no hour grid), Dashboard (drag & drop, hide/show, widgets "Heute & Morgen", "Offene ToDos", "Nächste Erinnerungen"). Core modules are `defaultEnabled`.
3. **Finance, Invoices, Subscriptions** – done: cross-links via bus + service + public read API, calendar/notification contributions, dashboard widgets (`Kontostand`, `Fällige Rechnungen`, `Nächste Abbuchungen`), month overview with charts, accounts/categories/bookings. Core modules: calendar 10, todos 20, reminders 30, finance 40, invoices 50, subscriptions 60 (all `defaultEnabled`).
4. Sync adapters + server + backup (JSON export/import) + encryption.
5. AI assistant (stage 1, then stage 2).
6. Bookmarks (Merkliste), extra modules (off by default), notifications/Web Push option, a11y/PWA polish.

## Gotchas
- Do not leave your own `vite preview` running on :4173 – Playwright reuses that port (`reuseExistingServer`) and would test a stale build. Stop it (`pkill -f "[v]ite preview"`) before `npm run e2e`.
- Async bus handlers (finance booking) finish *after* the UI action; E2E waits for their effect (e.g. poll IndexedDB) before navigating.
- E2E: a write is finished when the dialog that saved it has closed – wait for that (and for the UI to reflect it) before `goto`/`reload`. Fix the date with `page.clock.setFixedTime(...)`; `page.clock.install` + `fastForward` drives the notification scheduler. dnd-kit keyboard steps: wait for the live region (`[id^="DndLiveRegion"]`) between key presses.
- Native `<dialog>`: use `data-autofocus` for the initial focus target.
- Vitest inlines `dexie` + `dexie-react-hooks` (`vitest.config.ts`); otherwise two Dexie copies break `useLiveQuery`.
- TypeScript is pinned to 6.0.x (typescript-eslint supports `<6.1`); `baseUrl` is not used (paths are relative).
- In E2E, wait for the UI to reflect a write before navigating/reloading – writes are async IndexedDB transactions.
- No secrets in the repo. API keys/tokens go to the local `_secrets` table at runtime only.
