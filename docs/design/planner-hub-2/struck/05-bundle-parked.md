# Hand-off 05 – bundles of things (5b, parked)

The parked part of hand-off 05; steps and „Los“ (5a) are built. Concept: [CONCEPT-ROWS, idea 5](../CONCEPT-ROWS.md). Decision between two directions: [DESIGN §3](../DESIGN.md). Mockup: `mockups/05-bundle-a.html` (chosen; render with `mockups/render.mjs`). Shared rules: [00-common](00-common.md).

## 5b: making and unmaking – parked with 5b (build only on the maintainer's „ja“)

- A member line has **one** lead column: the tick where the member takes one, else its source glyph (an invoice) – never both; `▸` at the end when it has a panel; drag handle on desktop hover / focus (`SortableList` from `@/ui`), „Nach oben / Nach unten“ in the line's ⋯ on the phone.
- Selection bar (exists) gets B11 after „Verschieben …“; enabled from 2 rows. Dialog B12: one `TextField` (prefilled, selected, only from a plain-task member – the first one in the selection; with none the field is empty and „Bündeln“ waits for a typed name), primary „Bündeln“, the shared „Abbrechen“. Toast B13.
- A member that is a list is open inside the panel: its open items as tick lines (the lists panel's body, max 8 + X19 „n weitere“), `▾` folds it. In „Los“ a list member is one step that shows these tick lines under its title.
- The bundle takes the day of the first ticked row (or „ohne Tag“ if none had one); minutes = sum of the members'. While it lives, a member's own assignment rows (also one written later on another device) are ignored by board, run, proposals and `plannedDay`: the bundle wins.
- „Bündeln …“ is only in the selection bar, never in a row's ⋯, and only while every chosen row belongs to a linkable module (the rule of „Thema …“); a member is resolved by its `entityId`, else its item id – a member of a module that is not linkable cannot exist (test).
- The bundle source returns only the title and the member keys in order; the board joins titles, minutes and done state from the entries it already holds. A member no source lists any more is done or gone – `resolveLink` tells (`done` → a done step, `gone` → B17). The planner's own source never calls the collector. A bundled thing is never a pile member (test).
- Panel ⋯: „Umbenennen …“, „Als Routine speichern“ (only if all members are plain tasks – no legacy `links[]` entry and no `origin` link row; the lookup, emit and toasts B16 / B25 / X7 as in 5a), „Auflösen“ (toast B15).
- A line's ⋯: B20 „Aus dem Bündel nehmen“ (the member is its own row on the bundle's day again), on the phone also B21 „Nach oben“ / „Nach unten“.

## Parked with 5b elsewhere in 05

- Closed row: a bundle's lead is the bundle glyph (three stacked lines), not a button; its meta is B2.
- „Los“: after the last member the same return to the plan, nothing to tick – the bundle is done when its members are.
- States: empty bundle after the last member left (the bundle row is removed in that same action).
