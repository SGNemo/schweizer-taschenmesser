# Hand-off 02 – collective rows (package 2)

Concept: [CONCEPT-ROWS, idea 2](../CONCEPT-ROWS.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/02-pile.html`.

## Structure

A pile is a `ThingRow` with:

- lead: the area's glyph (money: the invoices glyph; mail: the mail glyph), not a tick, not a button;
- title P1 / P2 (the expand button, as every row);
- meta: P3 parts joined by „ · “, zero parts left out; late money appends P4 as plain text; the earliest hard deadline as the existing „Frist Fr“ meta item;
- end: minutes (money 20, mail 30 by default; „Dauer …“ changes the pile's own `planner_item.durationMin`), lock, ⋯ (Verschieben …, Dauer …, Fest, P11).

Expanded (planner's own panel `PilePanel`):

```
RECHNUNGEN OFFEN                                   In Rechnungen ansehen
 [€] Stadtwerke · 80,00 € · Frist Fr 4. Dez.              ▸
 [€] Zahnarzt · 120,00 € · Frist Do 10. Dez.              ▸
 [€] Versicherung · 45,90 € · Frist war So                ▸
KÜNDIGUNGSFRISTEN                                     In Abos ansehen
 [↺] Streaming Plus · kündigen bis Mi 9. Dez.             ▸
BUDGETS ÜBER DEM RAHMEN                            In Budgets ansehen
     Lebensmittel · 40 € über dem Rahmen
```

- Part head: P7, caps style; its jump P8 is a quiet link at the head's right end (phone: under the part's last line).
- A member line is a `PanelLine` whose text is the member's title + `detail`; `▸` expands the member **inside the pile** (nested compartment, one level, same component, indented `--space-4`): there its module panel from hand-off 04 („Bezahlt“ …). One member open at a time.
- A part without members (budgets, mail queue) is text lines (≤ 5, then „n weitere“) without `▸`.

## The offer (P5)

One line at the top of „Noch ohne Tag“ (inside the group, under its head): text + one quiet button; ✕ at the end (name „Nicht mehr anbieten“). Shown when ≥ 3 single rows of one area wait there and the switch was never set. One offer at a time (money before mail). Tap → `planner.piles.<area> = true`, toast P6 with undo. ✕ → device-local flag, no toast.

## States

offered · unplaced · placed · fest · expanded · member expanded · nothing waits, placed (P9, ticked style: title struck as done rows are, no parts) · part's module off (part missing) · „Werte ausblenden“ (amounts hidden, counts stay).

## 1920 / 412

Per 00-common. 412: meta wraps to two lines at most (parts first, deadline second); the jump links stand under their part.

## Edge cases

- A member gets a day by hand (member line ⋯ „Auf einen Tag legen …“): it leaves the pile and is its own row; the count falls.
- A pile on a day that passes with things still waiting: it goes to „Noch offen“ like any row; „nichts wartet“ piles do not.
- The pile is `excluded` („Nicht planen“): single rows stay folded; the offer is not repeated.
- Mail queue route missing (older mail module, phone): the mail pile does not exist.
- 20 invoices: the part shows 5 + „15 weitere“ (shows 5 more per tap).

## Tests

- `pile.test.ts` (core grouping): members folded only while unplaced and unlocked; a placed member is not counted; zero count → no unplaced row.
- Each module's `pile.test.ts`: reads own data only; routes are fixed strings.
- Route params `?view=` in invoices / subscriptions / budgets: allow-list, zero writes, param removed (pattern `payRoute.test.tsx`).
- Write spy: a count that changes writes nothing in the planner.
- e2e seed `e2e/seed/plan-pile.seed.spec.ts`: offer → one row → expand → pay one → count falls.
- `planner-hub-2.spec.ts` flow B `rowsBefore` re-measured.
