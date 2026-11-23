# Hand-off 10 – the mark „Im Plan · Mi“ (package 10b)

Concept: [CONCEPT §1.4](../CONCEPT.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/10-mark.html`.

## Structure

`PlanMark({ module, id, variant })` in `core/entitylinks`: reads `planRowState` + `planFacts` (lock) (+ the bundle name from 5b); renders nothing while loading, while the planner is off, and when the thing is not in the plan. Two reads are new in `planRow.ts` / `plannedDay`: an item key matches the entity when it equals `<module>:<id>` or starts with `<module>:<id>:` (subscriptions, routines and Unterlagen plan per occurrence), and for M4 the latest live assignment before today when none lies from today on. The day of a thing that is no plan row comes only from ToDos linking to it with `origin` / `about`. Bookmarks and subscriptions pass their own field as `fallback` (shown as M3 while the planner has no row yet).

- `variant="meta"` (rows): inline in the row's meta line, **last** item, separated by „ · “. Planner glyph 16 px + text M1–M5, `--text-meta`, `--text-3`; the whole mark is one link (underline on hover / focus only).
- `variant="detail"` (detail panels, dialogs): its own line under the title block, same type, min-height 44 px.
- Target: `/planner?item=<module>:<id>`.

## Where (10b touches each module's row and detail once)

| Module | Row | Detail | Replaces |
| --- | --- | --- | --- |
| ToDos | meta | editor head | `todos/components/PlanMark.tsx` (delete; keep the filter „Stand im Plan“) |
| Rechnungen | meta | `InvoiceLinks` „Im Plan“ line | the line's own text |
| Listen | list card meta | list head | – (⋯ entries stay) |
| E-Mail | thread row meta | thread head | „Im Plan“ / „War im Plan“ texts |
| Notizen | note row meta | note head | – |
| Kalender | – (agenda rows stay clean) | event detail | – |
| Abos | row meta | detail | `plannedDeadline` „Im Plan“ |
| Merkliste | row meta | – | `inPlan` „im Plan“ |
| Unterlagen | row meta | detail | – |
| Routinen | row meta | detail | – |

## States

not in plan (nothing) · M1 · M2 · M3 · M4 (plain, never a tone) · M5 (in a bundle) · planner off (nothing) · loading (nothing; no layout jump: the meta line already has its height).

## 1920 / 412

Same. On 412 a meta line that would wrap drops the module's own second meta item before it drops the mark (`useOverflowMark` pattern); the mark never wraps inside itself.

## Edge cases

- A thing on several days (parts): the earliest day from today (`plannedDay`).
- Only a passed day: M4. A done thing: no mark.
- Unterlagen: the mark is fine (it names a day, not the document); the label a link stores is the category word.
- Stimulus: each module view gains at most one link per planned row. Run `npm run check:stimulus`; the seeded views have ≤ 3 planned rows each, inside the 10 % tolerance. If a view breaks its budget, the mark moves to the detail only for that module and the PR says so.

## Tests

- `PlanMark.test.tsx`: the six states; nothing rendered while the planner is off.
- `planRow.test.ts` grows: the prefix match (a subscription placed from the planner shows M1; `todos:ab` never matches `todos:abc`), the passed-day read, the fallback; write spy: app start and rendering marks write nothing.
- e2e seed (new file `e2e/seed/plan-mark.seed.spec.ts`): an invoice, a list, a note, a subscription, a bookmark placed on Wednesday show M1 and the link lands on the row.
- `planner-hub-2.spec.ts` D1 re-measured.
