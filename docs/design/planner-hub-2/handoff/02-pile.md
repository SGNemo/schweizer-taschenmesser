# Hand-off 02 – collective rows (package 2)

Concept: [CONCEPT-ROWS, idea 2](../CONCEPT-ROWS.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/02-pile.html`.

## Structure

A pile is a `ThingRow` with:

- lead: the area's glyph (money: the invoices glyph; mail: the mail glyph), not a tick, not a button;
- title P1 / P2 (the expand button, as every row);
- meta: P3 parts joined by „ · “, zero parts left out; late money appends P4 as plain text; the earliest hard deadline as the existing „Frist Fr“ meta item;
- end: minutes (money 20, mail 30 by default; „Dauer …“ changes the pile's own `planner_item.durationMin`), lock, ⋯ (Verschieben …, Dauer …, Fest, P11 – no „Nicht planen“: the way out is P11 or the switch).

Expanded (planner's own panel `PilePanel`):

```
RECHNUNGEN OFFEN                                   In Rechnungen ansehen
 [€] Stadtwerke · 80,00 € · Frist Fr 4. Dez.     Bezahlt   ▸
 [€] Zahnarzt · 120,00 € · Frist Do 10. Dez.     Bezahlt   ▸
 [€] Versicherung · 45,90 € · Frist war So       Bezahlt   ▸
KÜNDIGUNGSFRISTEN                                     In Abos ansehen
 [↺] Streaming Plus · Kündigen bis Mi 9. Dez.             ▸
BUDGETS ÜBER DEM RAHMEN                            In Budgets ansehen
     Lebensmittel · 40 € über dem Rahmen
```

- A passed deadline in a member line reads X18 („Frist war So“).
- Part head: P7, caps style; its jump P8 is a quiet link at the head's right end (phone: under the part's last line).
- A member line is the member's panel in its `compact` form (CONCEPT-ROWS, idea 4): title + `detail`, and where the module has a one-tap end („Bezahlt“ for an invoice, the tick for a ToDo) that action at the line's end / lead (an invoice: „Bezahlt“ as a ghost button before `▸`; `PanelLine` takes one action plus the expand button); `▸` expands the member **inside the pile**: its module panel from hand-off 04 („Bezahlt“ …) follows the line, indented `--space-5`, **without a surface of its own** (a box in a box read as a hole in dark mode); the open member's title is 600; its foot is left-aligned inside the indent (so „Ganz öffnen“ reads as the member's, not the pile's) and `--space-3` separates it from the next member line. One member open at a time.
- `▸` is a button named X1 („{Titel}. Aufklappen / Zuklappen“).
- Budgets: one line per budget over its frame, rendered by budgets' own `compact` panel (the amount goes through `SensitiveValue`; the planner never holds it), ≤ 5 then X19 „n weitere“, no `▸`. Read only: never counted as finished in the planner. They are shown only while the money pile exists: a pile is a row only while it has something to do (members, or a mail queue count). When only budgets remain, an unplaced pile is gone and a placed one reads P9 „nichts wartet“.
- Mail: the queue part is mail's own one-line panel – P3 „4 warten“ · the button P15 „In den Plan … (4)“ · the jump P8. P15 opens mail's existing `PlanAllDialog` over the planner (mail's code): one tick per mail; bulk mail and mails whose ToDo was deleted stay unticked; nothing is written before that dialog's own button. Afterwards those mails are ToDos: member lines with a tick (mail names them by key, `todos:<id>`). The count is queue threads with no plan ToDo (open or done) + open member ToDos, so a mail put into the plan is not counted twice and a thread whose ToDo is done leaves the count. The mail chat's contract (count + route, no content) is unchanged.
- Members: core keeps a key only if it belongs to the pile's own module, or – for mail – is a `todos:` key whose `origin` link points to a mail thread (`linkEntries`); never `accounts`; at most 40 members per pile; the rest stay single rows in their usual group and are not counted in the pile's meta.
- The mark of a folded member: on a placed pile M5 with the pile's title („Im Plan · Mi · in „Finanzen checken““), linking to the pile's row (`?day=<d>&item=planner:pile-money`); on an unplaced pile M3, linking to the pile row. Package 2 extends the mark's read (10b prepared the prop).

```
 4 warten                              In den Plan … (4)   In E-Mail ansehen
── after PlanAllDialog's own „In den Plan (4)“ ──
 ○ Vermieter antworten wegen Nebenkosten
 ○ Angebot Fensterputz beantworten   …
```

## The offer (P5)

One line at the top of „Noch ohne Tag“ (inside the group, under its head): text + one quiet button; ✕ at the end (name „Nicht mehr anbieten“). Shown when ≥ 3 single rows of one area wait there and the switch was never set. One offer at a time (money before mail). Tap → setting `pileMoney` / `pileMail` = true, toast P6 („Rückgängig“ sets it back – an explicit inverse, the undo journal does not hold settings). ✕ (name P13) → device-local flag, no toast. Stimulus: the offer is one of the round's always-visible additions, listed completely in [DESIGN §5](../DESIGN.md) item 1 (with the mark, one chip in the existing chip line, the steps meta, the pile and bundle lead glyphs) – here two buttons until answered. If the seeded stimulus views show it and `check:stimulus` rises, that rise needs the maintainer's approval like any other (`docs/howto/ci-stimulus-budget.md`): package 2 then ships the switch in the settings only and leaves the offer line for his „ja“ – named in [PACKAGES #common](../PACKAGES.md#common).

## States

offered · unplaced · placed · fest · expanded · member expanded · nothing to do (only budgets or nothing left), placed (P9, ticked style: title struck as done rows are, no parts) · part's module off (part missing) · „Werte ausblenden“ (amounts hidden, counts stay).

## 1920 / 412

Per 00-common. 412: the meta is short, one line – P12 „6 Dinge“, then P4 „Frist vorbei: 1“ when something is late, else the earliest deadline („6 Dinge · Frist Fr“); the parts are in the panel. The jump links stand under their part.

## Edge cases

- To give one member a day of its own he uses P11 „Wieder einzeln zeigen“ (pile ⋯) and places it as today; a member that has a day or a lock is its own row and is not counted. A compact member line has no ⋯.
- A pile on a day that passes with things still waiting: it goes to „Noch offen“ like any row; „nichts wartet“ piles do not.
- Mail queue route missing (older mail module, phone): the mail pile does not exist.
- 20 invoices: the part shows 5 + X19 „15 weitere“ (shows 5 more per tap).

## Tests

- `pile.test.ts` (core grouping): members folded only while unplaced and unlocked; a placed member is not counted; zero count → no unplaced row; a member key of another module is dropped, except a mail pile's `todos:` key whose `origin` link points to a mail thread; an `accounts` key never.
- Mail count: a thread whose plan ToDo exists counts once (as the member); a thread whose ToDo is done leaves the count. P15 writes nothing before `PlanAllDialog`'s own button; bulk mail and mails whose ToDo was deleted are not revived (stay unticked).
- `members` capped at 40 per pile: 45 members → 5 single rows in their usual group, the count says 40; a folded member's mark reads M5 / M3 and links to the pile's row.
- Each module's `pile.test.ts`: reads own data only; routes are fixed strings.
- Route params `?view=` in invoices / subscriptions / budgets: allow-list, zero writes, param removed (pattern `payRoute.test.tsx`).
- Write spy: a count that changes – also to 0 – writes nothing in the planner. „Werte ausblenden“ hides the budget and invoice amounts in the pile; `copyInput` holds no pile content.
- e2e seed `e2e/seed/plan-pile.seed.spec.ts`: offer → one row → expand → pay one → count falls.
- `planner-hub-2.spec.ts` flow B re-measured (desktop rowsBefore 2, taps 17, perThing 12, switches 0, doneInPlanner 9, rowsAfter 0, replySwitches 0; phone 1, 10, 8, 0, 5, 0); its reading changes: the pile switches are set before `rowsBefore` is read, and expanding a pile is no `touch`.
