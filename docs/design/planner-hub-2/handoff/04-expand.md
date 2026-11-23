# Hand-off 04 – the expanded row (packages 4a, 4b, 4c)

Concept: [CONCEPT-ROWS, idea 4](../CONCEPT-ROWS.md). Decision between two directions: [DESIGN §2](../DESIGN.md). Mockups: `../mockups/04-expand-a.html` (chosen), `04-expand-b.html` (rejected), `04-states.html`.

## Structure

```
ItemRow  [lead] [title-button ▸ meta · chips] [minutes] [lock] [⋯]
└ RowCompartment (only while open)
   └ PlanPanelHost → the module's panel | default panel
      panel body: PanelLine × n, small heads
      panel foot: [module's secondary action]   [Ganz öffnen]
```

- The title becomes a `button` (`aria-expanded`, `aria-controls`), name X1. It replaces the title link: **the count of interactive elements per row does not change.**
- A 16 px chevron sits after the title, `--text-3`, rotated 90° while open (transform). Phone: the same.
- Open state: page state `openRow: unitId | undefined` in `PlannerPage` (lift into a hook `useOpenRow`), one at a time.
- Rows in „Noch ohne Tag“, „Frist vorbei“, „Noch offen“ expand the same way. Rows in a selection („Auswählen“) do not expand: the title toggles the choice as today.

## Panels (4a: default, ToDos, Listen, Merkliste · 4b: Rechnungen, Abos · 4c: E-Mail)

| Panel | Body | Foot |
| --- | --- | --- |
| default | `detail` line if any; links as `PanelLine`s with their chip word | X2 |
| ToDos | note: first 3 lines, `--text-sm`, clamp; checklist as tick lines (X14) | X2 |
| Listen | section heads (caps) + open items as tick lines, max 8, then X8 „n weitere“ (a button that shows 8 more) | „Fertig eingekauft“ when none is open (the module's existing step) · X2 |
| Merkliste | title, host as text | X13 · X2 |
| Rechnungen | line 1: payee · amount; line 2: „Frist Fr 4. Dez.“ or „Frist war So“ (plain); reminder line if dunned; then `PayStep` inline: `DateChips` (Heute · Gestern · Datum …), amount field prefilled, X9 „Bezahlt“ (secondary) | X2 |
| Abos | name · price / period; „Kündigen bis Do 10. Dez.“; two buttons X10 | X2 |
| E-Mail | line 1: sender name · day; line 2: subject (600); body: first 6 lines of the newest message, `--text-sm`, clamp, in `NoReadAid`-free plain text; X12 „Antworten“ opens mail's composer **in place of the body** (review step and the 10 s window as built) | „Beantwortet? · Erledigt“ when the newest message is his · X2 |

## States (mockup `04-states.html` shows each)

closed · loading · open · acting (button `aria-busy`, disabled) · done (the row fades and leaves; focus moves to the next row's title, or to the field when it was the last) · gone (X3 + X4) · unavailable (X5; mail on the phone X6) · error (X7 inside the panel).

## 1920 / 412

Per [00-common](00-common.md). On 412 the `PayStep` stacks: chips, amount, button full width (min-height 44 px). The mail body shows 4 lines.

## Edge cases

- The open row is ticked from the lead: the compartment closes with the row.
- The open row moves to another day (drag, `M`): it stays open on the new day.
- A sync round changes the thing while open: the panel re-reads (live query); a field he is typing in (amount) is never overwritten; no extra notice is added – the module's own form rules apply.
- A long list (60 items): 8 + „52 weitere“, each tap shows 8 more; no inner scroll.
- „Werte ausblenden“: amounts are placeholders in panel and toast.
- Print / copy: „Plan als Text kopieren“ never contains panel content (`copyInput` test grows by one case).

## Tests

- `RowCompartment.test.tsx`: one open at a time, Esc, focus return, selection mode.
- `PlanPanelHost.test.tsx`: lazy, boundary (a throwing panel shows X7 and the sheet lives), `accounts` never mounted, module off → X5.
- Per panel a component test with its states; invoices: paying from the panel writes what `PayStep` writes on the page and nothing in the planner (write spy).
- Write spy: opening and closing any panel writes nothing anywhere.
- e2e seed `e2e/seed/plan-expand.seed.spec.ts`: pay an invoice, tick two list items, tick a checklist line – without leaving `/planner`.
- `planner-hub-2.spec.ts` flow B re-measured (4b: money, 4c: mail).
