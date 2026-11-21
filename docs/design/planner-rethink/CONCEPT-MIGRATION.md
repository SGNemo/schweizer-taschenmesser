# Planner rethink – data, migration, sync, sources

Part of [CONCEPT](CONCEPT.md). Paths under `web/src/`. Rule above all: **no write without an action of the person** – with one named exception, the one-time migration (§2).

## 1. Stored shape

| Collection | Stays | Changes |
| --- | --- | --- |
| `planner_assignment` (id `<itemKey>#<k>`, index `date`, `itemKey`) | `date`, `minutes`, `order`, `k` | new `locked?: boolean`; `of`, `reason`, `bumpedBy`, `late` are no longer written and ignored on read (dropped from the schema with `manifest.version` + a no-op migration); rows of fixed blocks are no longer stored (a training at 18:00 is read live from its source) |
| `planner_item` | `excluded`, `due { hard, time }`, `part`, `skipped`, `order` | `pinned` goes after the migration; `earliest` and `splittable` are no longer read |
| `planner_day` | all | – |
| `_meta` (device-local) | – | `planner.lastRun` (hash, row signature, unplaced, titles) is deleted; calendar block titles come from the source list |

`manifest.dataApi: false` and „no `aiSchema`“ are untouched; so is field LWW (nothing here changes `core/sync/ops.ts` or its two siblings).

## 2. The one-time migration

Runs once per device on the first start of the new version, after `syncSettled()`, inside the planner service; deterministic (two devices that both run it write the same field values) and idempotent (it keys on data, not on a flag: a restored old backup is migrated again).

| Found | Becomes | Why |
| --- | --- | --- |
| a placement row of an open thing | stays as it is = laid | nothing moves at the update |
| `item.pinned` equal to the date of the thing's row | `locked` on that row, `pinned` cleared | today's „fest“ is the lock |
| `item.pinned` different from the row's date (the pin had passed, or lay beyond the horizon and the run placed the thing elsewhere) | row stays where it is, **not** locked, `pinned` cleared | the row is where he sees the thing today; a lock on a day he did not see would be a silent claim |
| a row written for a fixed block | removed | derived live |
| a thing the last run left waiting | no row = „Noch ohne Tag“ | – |
| a waiting ToDo with an own date (`plannedFor` set by him, read as „earliest“ so far) | stays without a day; the date stays on the ToDo | only a date he sets from now on makes a row (§4); an old date in the past must not fill the missed group |
| setting `autoReplan` | set to `false` (synced) | stops the background runs of a device still on the old version (§5) |

Acceptance for package 1: on a copy of the seed and on a plan shaped like U1 after its repair (everything pinned, two pins passed) – every row of an open thing before = the same row after, same date; locked exactly where pin and row agreed; a second pass writes nothing.

## 3. Things that are done, deleted or reopened

- Every reader goes through **one selector** (`placements(range)` = rows whose thing is open at its source); load, calendar chips, the widget, `quickCapture/targets/index.ts:232 plannedOn` and the mail label use it. A row of a finished thing is invisible at once, without a write.
- The row is removed (tombstone) by the tick in the planner (same action, same undo) and otherwise by the tidy step inside the next planner action that writes – never by a timer.
- A thing reopened at its source before that tidy step is back on its day (on a passed day: in the missed group) – it was there. A recurring thing's next occurrence is a new thing: no day, or the day its source gives it.

## 4. Mirror to ToDos (`plannedFor`, `planMark`)

- **Planner → ToDo:** the action that sets, moves or removes a placement writes `plannedFor` + `planMark { date, order }` for that thing (`onAssign`), in the same undo entry. No pass over all things.
- **ToDo → planner:** every ToDo-side writer already goes through one helper (`modules/todos/views.ts:26 userPlannedFor`); it additionally emits `plan.dayRequested { ref, date | undefined }` on the bus, and the planner lays, moves or removes the row in answer (no write back to the ToDo, so no loop). A date cleared in ToDos takes the thing off its day.
- **Divergence** (a date changed on a device where the planner is off, an import): the row wins while it exists; the next action on the thing mirrors again. The planner never „adopts“ in the background.
- **Switching the planner off:** a laid day is his decision and stays on the ToDo as his date (the mark is cleared, `plannedFor` kept) – unlike today, where the planner's dates are taken back (`modules/todos/planMark.ts:19`).
- **Sync gate** `syncSettled()`: needed for the migration only.

## 5. Two devices

- A placement is ordinary synced data: the later action wins per field; day and lock are fields of one row. No device recomputes another device's plan; „two devices converge“ is the plain LWW case and gets one test (move on A, lock on B → row on A's day, locked).
- **A device still on the old version** is the one real risk. Its engine would, on every run: remove rows its result does not contain (also rows laid beyond its horizon), place passed rows anew (the missed trace is gone on both devices), cut long things into parts, and clear `plannedFor` of what it leaves waiting. The migration's `autoReplan = false` stops its background runs (midnight, live query); an action in the old planner still runs the old engine. Therefore: phone and PC get the version in the same release, and the change note says plainly „erst alle Geräte aktualisieren, dann planen“. A hard gate would need a sync protocol version – out of scope, listed as open.
- **Backup:** restoring an old backup runs the migration again; no run follows; passed rows show as missed.

## 6. Sources

| Source thing | Arrives as |
| --- | --- |
| a dated occurrence (training session, routine's turn) | laid on that day (`dayOf`, no row needed), no tap |
| a ToDo dated in ToDos (from the update on) | laid on that day (row through `plan.dayRequested`, §4) |
| carries a deadline only (invoice, cancellation, document, gift, packing list) | „Noch ohne Tag“ with the chip „Vorschlag: Do · Frist Fr“; one tap lays it (question 2) |
| timed block (`fixed`) and habit blocks | shown at their time, never a placement, never movable here |
| asked in by „In den Plan“ (`plan.requested`) | laid on the day asked for, else today |
| everything else (open ToDos without a date) | „Noch ohne Tag“ |

The `plannable` contract (`core/modules/types.ts`) needs no new field for this: `earliest === due.date` with a date at the source already marks „its own day“ for fitness and routines; if package 6 finds a source where that is ambiguous, it adds an explicit `day?` there – a hotspot change with a heads-up.

## 7. What every package has to keep true

1. No row changes its `date` except in an action that names that thing (test: snapshot of all rows before and after every action of the planner's action list).
2. Midnight, app start, tab focus, a sync round and an edit in another module write nothing in the planner's tables (test with a write spy; the migration is the one exception and writes nothing the second time).
3. Every action that writes is one undo entry, including „Übernehmen“ of any preview, multi-select moves, „In Teile aufteilen …“ and „Zeiten dieser Woche“.
4. A preview that is closed changed nothing.
