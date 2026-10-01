# Core: modules, data, shared blocks, state, UI, PWA

Part of the architecture notes ([index](../architecture.md)); map of paths: [ARCHITECTURE-MAP](../ARCHITECTURE-MAP.md); decisions: [DECISIONS](../DECISIONS.md).

**Modules.** Each module is `web/src/modules/<id>/` with a `manifest.ts` (`ModuleManifest`, see `core/modules/types.ts`). Manifests are discovered with `import.meta.glob` (eager, tiny); routes and widgets are `import()`-lazy. State (enabled/disabled) is in the synced `_modules` table; without an explicit choice `defaultEnabled` applies. Disabling asks: keep data (hidden) or delete (tombstones, so the deletion syncs). `devOnly` modules (the `example` module) are only listed in dev builds / with `VITE_INCLUDE_EXAMPLE=true` (`.env.e2e`).

**Isolation.** Modules never import each other (enforced by ESLint `no-restricted-imports` and by `registry.test.ts`, which scans the source). They communicate via

- the typed **event bus** (`core/events`, catalogue in `events.ts`),
- **manifest contributions** (`contributions.quickAdd`, `calendarItems`, `notifications`; loaders are lazy `() => import()` so manifests stay free of DB imports; collected by `core/modules/contributions.ts`),
- the only exceptions (read-only `public.ts`, enforced by ESLint + `registry.test.ts`): `finance` may import `subscriptions/public.ts` and `invoices/public.ts`; `budgets` may import `finance/public.ts` (expense categories, spending per category and month).

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

**State.** Data = Dexie + `useLiveQuery`. Zustand (`stores/ui.ts`) = UI-only state (theme, palette, quick add, toasts). Theme lives in `localStorage` + inline script in `index.html` (no flash).

**UI.** CSS Modules + tokens (`ui/tokens.css`), light/dark, `prefers-reduced-motion` respected. Primitives in `web/src/ui` (Button, Dialog on native `<dialog>`, Fields, Card, Toaster…). Icons: `lucide-react` via `ui/icons.tsx` (`IconName`). Sidebar ≥ 900 px, bottom nav below, quick-add FAB, command palette (Ctrl+K). Touch targets ≥ 44 px, visible focus. **Page layout:** the shell has no width cap; every page sits in `layout/PageContainer` (variants `narrow` 45rem · `content` 70rem (default) · `wide` 100rem · `full`), chosen by `manifest.layout` (or `route.layout`) – modules never set their own `max-width`. The container is a CSS size container named `page`: use `@container page (min-width: …)` for inner layouts (card grids, columns), `useMediaQuery` / `useSplitView` only for structural changes (side panel vs. dialog). On desktop (≥ 900 px) `main` scrolls, not the window; pages that should fill the height are flex children of `.page`. Dialog autofocus: use `data-autofocus` (React `autoFocus` runs before `showModal()`).

**PWA.** `vite-plugin-pwa` with `injectManifest` (`src/sw.ts`), update prompt via toast. Android Chrome has no `new Notification()` → notifications must go through `registration.showNotification`.

