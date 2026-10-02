# Decisions – modules and tools (package 1 "Aufräumen", 0.4.0)

Index: [DECISIONS](../DECISIONS.md). Plan: [product/MODULE-PLAN.md](../product/MODULE-PLAN.md).

## Retired modules
- **Why not delete the tables:** a sync pull skips ops for unknown tables and the cursor moves on (the data never returns); Dexie drops tables that leave the schema together with their data; the server accepts any table name, so an older device keeps writing. Hence `retired` keeps `schema.ts`, `repo.ts`, `migrations.ts`, `manifest.ts`.
- **Contract (`validateRetired`):** no routes, widgets, `aiSchema`, `area`, `contributions`, `defaultEnabled`; `seed: { none: 'retired' }` and no `seed.ts`. `visibleManifests` (and so `availableManifests`, library, router, nav, AI, services) skips them; `allManifests` keeps them for schema, sync, backup, setup "has data". `apiCollections` returns `[]` (import API closed). Old paths `/news`, `/habits`, `/timetrack` redirect to `/` (`router.tsx`).
- **Removed with news:** `core/ai/newsBrief.ts`, start package, `e2e/news.spec.ts`, manual tests N1–N4, `architecture/news.md`. Kept: `core/io/feed.ts`, `core/net/fetchPublic.ts`, proxy `/v1/proxy` (also used by ICS).
- **Tables leave in package 6** (all devices ≥ 0.7, `schema-upgrade.test` allow-list).

## Tools
- IDs: percent/split → `calc`, base64/json/uuid/hash → `dev`, scratch dropped. `migrateToolIds` maps on read (explicit choice for the new id wins, otherwise "on" if any source was on); nothing is written until the next normal save.
- Tools may not import each other (`tools/isolation.test.ts`), so the merged logic moved into `calc/` and `dev/`.

## Notizzettel
- `scratch` note: id `scratch`, title "Zettel", pinned, sorted first, no delete (only "Zettel leeren"). `notes/services.ts` copies `_settings` `tools.scratch.text` once (not if the note exists, deleted ones count as existing, not for empty text) and re-checks on every change of that row (covers sync pull and backup import). Notizen is off by default; the copy runs when it is on.

## Dieser PC
- **2026-10-02 – more facts, same rules.** Drive cards (type, interface, model, health/temperature, history), quick overview and live system tiles stay read-only and local. Health, temperature and history are **session-only**: Windows data is read on demand with access 0 (no admin), "nicht verfügbar" says why; the history for sparklines and "belegt seit letztem Scan" is kept in memory only (`history.ts`, `live.ts`) – no collection, no `_meta` row, nothing synced or backed up. The block list, plan/confirmation and recycle-bin-first delete are untouched; the recycle bin is only measured (emptying stays in Explorer). The public IP is asked for **only on a click** (`api.ipify.org`, noted next to the button, answer shown not stored) – the one deliberate exception to "no request", and it never runs on its own. GPU detection merges DXGI with the display-class registry key so the Basic Render Driver is never shown instead of the real card. Android keeps no Dieser PC (a mobile variant is in the ROADMAP).
- `disk` is "Dieser PC" with tabs Laufwerke · System (`?tab=`). Widgets `disk:status` and `disk:system`. Still no data, no aiSchema, blocked twice for the data API (`BLOCKED_MODULES` no longer lists `system`).

## App migrations and Listen (0.5.0)
- **Runner** (`core/db/appMigrations.ts`, steps in `appMigrationSteps.ts`): copies rows between collections with the source HLCs (1:1 fields keep their stamp, derived fields get the row's newest stamp, made-up rows `BASE_HLC`) via `applyRemote(…, { markDirty: true })`. Every device writes identical ops, so a second run, a second device or a sync echo changes nothing; edits of the target win; an edit of the source on a not-yet-updated device flows in on the next run. Tombstones are copied, sources never deleted. Not `createRepo.create` (fresh stamps per device would diverge).
- **Triggers:** end of `initCore`, after a sync pull that applied rows, after a backup import (`restamp` after "replace" so copies beat the tombstones the restore left). Serialised, errors swallowed (retry next run). Marker `_meta` `app.migrations.<id>` is informational only.
- **Steps:** `shopping_item` → `lists_item` (list `shopping-default`, made up with `BASE_HLC`, a tombstone counts as existing), `packing_list` → `lists_list`, `packing_item` → `lists_item` (`packed` → `done`), `launcher_link` → `bookmarks_item` (`kind: link`, `tags: [group]`).
- **Listen** (`lists`): kinds shopping | packing | checklist; the `shopping.requested` event stays (Pantry checks `moduleStates.lists`); quick capture type "Einkauf" (`l`). **Lesezeichen** are not a module but a view (`?view=links`); the eight launcher presets are gone, mailto:/tel: links are re-saved as http(s) only. Old paths redirect (`LEGACY_REDIRECTS`).
- Old devices keep writing the old tables (no backward sync): all devices must update.

## Unterlagen and Personen (0.6.0)
- **Unterlagen** = `vault` + contracts: `document` gets `category 'warranty'`, `provider`, `startDate`, `endDate`, `noticeDays`; `expiresOn` stays readable (`endOf`), is never written, and the module migration v2 renames it. One status function (`act-now`/`expired`/`soon`/`ok`/`open-ended`: deadline within 30 days, end within 60 days without a deadline). Two reminder leads (`remindDaysBefore` 30, `remindDaysBeforeDeadline` 14); a service carries the old `module.contracts` lead over once.
- **Personen** = `birthdays` + `gifts`: `person {name, birthday?, note, tags}` and `gift {personId, …}`; `aiSchema` for `person` only (gifts are surprises). Birthday notification keys keep the `birthday:<id>:<date>` form. Settings of `module.birthdays` are carried over once.
- **Steps:** `contracts_contract` → `vault_document` (`kind` → `category`), `birthdays_birthday` → `people_person`, `gifts_idea` → `people_gift`. A gift joins the person (former birthday, smallest id) with the same name (trimmed, lower case, one space); otherwise a person `person-<slug>` is made up (`ensure`, `BASE_HLC`), named after the first spelling. No fuzzy matching. A gift migrated before its birthday has synced keeps the made-up person (rare, left as is).
- Runner gained `prepare(database, rows)` and `ensure(rows, ctx)` for steps that read other tables.

## Zeit (0.7.0)
- **Erinnerungen** are calendar events of the kind `reminder` (`kind` missing = event, no data migration) with `notify {minutesBefore, enabled}`; paused = `enabled: false` (stays in the tab, off the calendar). Calendar notification source: key `event:<id>:<date>T<time>`, all-day events at `allDayNotifyTime`. Step `0.7.0-reminder` copies `reminders_reminder` (`time` → `startTime`, `active` → `notify.enabled`). The scheduler cursor is time-based and the Android list is rebuilt as a whole, so old `reminder:` keys need no carry-over. The `module.reminders` default time moves to `defaultReminderTime` once.
- **Assistant:** "Erinnerung" queries the calendar with `kind = reminder`; the quick-capture type `reminder` writes such an event.
- **ToDos:** `recurrence?` – ticking off keeps the task (history) and creates the next one with the deterministic id `<first id>:<due date>` (`createMany` skips existing ones, so two devices never duplicate); reopening removes the open next one. `someday` keeps tasks out of open views, widget, "Jetzt wichtig" and calendar; open recurring tasks show their later occurrences on the calendar.
