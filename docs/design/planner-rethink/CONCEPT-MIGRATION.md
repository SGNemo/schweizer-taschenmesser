# Planner rethink – data, migration, sync, sources

Part of [CONCEPT](CONCEPT.md). Paths under `web/src/`. Rule above all: **the planner's tables change only in an action that names the thing or the day** – with one named exception, the one-time migration (§2).

## 1. Stored shape

| Collection | Stays | Changes |
| --- | --- | --- |
| `planner_assignment` (id `<itemKey>#<k>`, index `date`, `itemKey`) | `date`, `minutes`, `order`, `k` | new `locked?: boolean`; `of`, `reason`, `bumpedBy`, `late` are no longer written and ignored on read (dropped from the schema with `manifest.version` + a no-op migration); rows of fixed blocks are no longer stored (a training at 18:00 is read live from its source) |
| `planner_item` | `excluded`, `due { hard, time }`, `part`, `skipped`, `order` | `pinned` is cleared by the migration and no longer written; `earliest` and `splittable` are no longer read |
| `planner_day` | all | – |
| Settings (synced) | the rest | `autoReplan` is set to `false` once and hidden (§5); the new switch „Neues automatisch vorschlagen“ gets its **own key** `suggestNew` (default off) |
| `_meta` (device-local) | – | `planner.lastRun` is deleted; new `planner.model = 2` marks the migration as done on this device |

`manifest.dataApi: false` and „no `aiSchema`“ are untouched; so is field LWW (nothing here changes `core/sync/ops.ts` or its two siblings).

## 2. The one-time migration

Runs when the device-local flag `planner.model` is missing: on the first start of the new version and after a backup restore (a restore replaces `_meta`, so the flag is gone). It waits for `syncSettled()`, is deterministic (two devices that both run it write the same field values) and sets the flag last. It does not look at the data again afterwards – rows a device on the old version writes later are not „re-migrated“.

| Found | Becomes | Why |
| --- | --- | --- |
| a placement row | stays as it is = laid | nothing moves at the update |
| `item.pinned` equal to the date of the thing's row | `locked` on that row, `pinned` cleared | today's „fest“ is the lock |
| `item.pinned` different from the row's date (the pin had passed, or lay beyond the horizon and the run placed the thing elsewhere) | row stays where it is, **not** locked, `pinned` cleared | the row is where he sees the thing today; a lock on a day he did not see would be a silent claim |
| a row written for a fixed block | removed | read live |
| a thing the last run left waiting | no row = „Noch ohne Tag“ | – |
| `plannedFor` / `planMark` on ToDos | untouched (also `planMark.prior`) | they already mirror the rows |
| setting `autoReplan` | `false` | §5 |

Acceptance for package 1: on a copy of the seed and on a plan shaped like U1 after its repair (everything pinned, two pins passed) – every row before = the same row after, same date; locked exactly where pin and row agreed; a second start writes nothing.

## 3. Things that are done, deleted, switched off or not listed

- Every reader inside the planner goes through **one selector**: `placements(range)` = rows whose thing an active source lists as open. A row whose thing is finished is invisible at once, without a write. The selector **hides, it never deletes**.
- A row is removed only by an action on that very thing: the tick in the planner, „Vom Tag nehmen“, „Nicht planen“ (same action, same undo). There is **no tidy step**: a source that throws (`core/modules/contributions.ts:83` returns an empty list), a module that is switched off, or a thing outside a source's listing window must never cost a placement. Rows of finished things stay as a few bytes; the last package measures their growth and, only if needed, adds a clean-up that asks the source about exact ids.
- A thing reopened at its source is back on its day (on a passed day: in the missed group) – it was there. A module switched on again shows its rows again. A recurring thing's next turn is a new thing.
- Sources that list only from today on (fitness, people) keep their own handling of passed things (`modules/planner/passed.ts`).

## 4. ToDos: one truth, one direction

- **The row is the only truth about the day in the planner.** Planner → ToDo: the action that sets, moves or removes a placement writes `plannedFor` + `planMark { date, order }` for that thing (`onAssign`) in the same undo entry; it never writes `prior`. No pass over all things, no write when only the lock or the order of another thing changes.
- **A date set in ToDos is not copied into the plan.** Where the ToDo's own date (mark missing or for another day) differs from the row – or there is no row – the planner shows a muted row with the chip „In ToDos: Do“ **on that date's sheet** (so „Für heute“ is visible on today at once); one tap („Hierher legen“) lays it there. The row is derived, never stored, counts for no load, and a date before today shows the chip under „Noch ohne Tag“ instead. So: no bus mirror, no background adoption, no loop, and a ToDo undo needs no second undo in the planner. Named cost: one tap in the planner until the thing counts as laid.
- **Scope of `dayOf`:** the planner's own surfaces, its calendar chips and widget, and the readers of the rows (`quickCapture/targets/index.ts:232`, mail „Im Plan · Mi“). The ToDo views keep reading `plannedFor`.
- **Switching the planner off:** `plannedFor` stays on the ToDo as his date and the mark is cleared; only where a `planMark.prior` from the engine's time exists, that date comes back as today (`modules/todos/planMark.ts:19`). Policy „keep“: rows stay and show again on re-enable. Policy „delete“: rows, locks and parts are gone; on re-enable the ToDos carry their dates and show the chip „In ToDos: …“ – nothing is laid without a tap.
- **Sync gate** `syncSettled()`: needed for the migration only.

## 5. Two devices

- A placement is ordinary synced data: the later action wins per field; day and lock are fields of one row. No device recomputes another device's plan. One convergence test covers: move on A + lock on B → row on A's day, locked; remove on A + move on B → **removed** (`deletedAt` is its own field and wins – accepted, the undo of the removal brings it back).
- **A device still on the old version** is the one real risk. Its engine would, on every run: remove rows its result does not contain (also rows laid beyond its horizon), place passed rows anew (the missed trace is gone on both devices), cut long things into parts and clear `plannedFor` of what it leaves waiting. `autoReplan = false` (written once by the migration, hidden afterwards, never reused) stops its background runs; an action in the old planner still runs the old engine. Therefore: phone and PC get the version in the same release, and the change note says plainly „erst alle Geräte aktualisieren, dann planen“. A hard gate would need a sync protocol version – out of scope, listed as open.
- **Backup:** restoring an old backup runs the migration once more; no run follows; passed rows show as missed.

## 6. Sources

| Source thing | Arrives as |
| --- | --- |
| a dated turn (training session, routine's occurrence) – marked by a new optional `day` on `PlannableItem`, set only by those sources | shown on that day by `dayOf` without a row; moving it writes a row |
| carries a deadline only (invoice, cancellation, document, gift, packing list) | „Noch ohne Tag“ with the chip „Vorschlag: Do · Frist Fr“; one tap lays it (question 2) |
| timed block (`fixed`) and habit blocks | shown at their time, never a placement, never movable here |
| asked in by „In den Plan“ (`plan.requested`) | laid on the day asked for, else today |
| a ToDo dated in ToDos | muted row with the chip „In ToDos: Do“ on that day (§4) |
| everything else | „Noch ohne Tag“ |

`day?` is the one change to the `plannable` contract (`core/modules/types.ts`, a hotspot: heads-up in the notes repo before package 1 starts).

## 7. What every package has to keep true

1. No row changes its `date` or disappears except in an action that names that thing (test: snapshot of all rows before and after every action of the planner's action list).
2. Midnight, app start, tab focus, a sync round and an edit in another module write nothing in the planner's tables (write spy). The migration is the one exception and runs once per device.
3. Every action that writes is one undo entry, including „Übernehmen“ of any preview, multi-select moves, „In Teile aufteilen …“ and „Zeiten dieser Woche“.
4. A preview that is closed changed nothing.
