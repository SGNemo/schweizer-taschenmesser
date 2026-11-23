# Hand-off 04 – the expanded row (packages 4a, 4b, 4c)

Concept: [CONCEPT-ROWS, idea 4](../CONCEPT-ROWS.md). Decision between two directions: [DESIGN §2](../DESIGN.md). Mockups: `../mockups/04-expand-a.html` (chosen), `04-expand-b.html` (rejected), `04-states.html`.

## Structure

```
ItemRow  [lead] [title-button ▸ meta · chips] [minutes] [lock] [⋯]
└ RowCompartment (only while open)
   └ PlanPanelHost → the module's panel | default panel
      panel body: PanelLine × n, small heads
      panel foot: [the module's actions, left]        [Ganz öffnen, right]   ← every action of a panel lives in the foot, nowhere else
```

- The title becomes a `button` (`aria-expanded`, `aria-controls`), name X1. It replaces the title link: **the count of interactive elements per row does not change.**
- Chevron: none on a closed row. Only the open row shows one – 16 px, after the title, `--text-3`, pointing down. On the desktop a closed row's title shows it on hover and keyboard focus only (not in the DOM otherwise, so the stimulus inventory does not count it); the phone shows it only on the open row.
- Switch X15 „Zeilen aufklappen“ (planner settings, on): off = the title is the link it is today, no chevron.
- Open state: page state `openRow: unitId | undefined` in `PlannerPage` (lift into a hook `useOpenRow`), one at a time.
- Rows in „Noch ohne Tag“, „Frist vorbei“, „Noch offen“ expand the same way. Rows in a selection („Auswählen“) do not expand: the title toggles the choice as today.

## Panels (4a: default, ToDos, Listen, Merkliste · 4b: Rechnungen, Abos · 4c: E-Mail)

| Panel | Body | Foot |
| --- | --- | --- |
| default | `detail` line if any; links as `PanelLine`s with their chip word | X2 |
| ToDos | note: first 3 lines, `--text-sm`, clamp; checklist as tick lines (X14) | X2 |
| Listen | section heads (caps) + open items as tick lines, max 8, then X8 „n weitere“ (a button that shows 8 more) | „Fertig eingekauft“ when none is open (the module's existing step) · X2 |
| Merkliste | title, host as text | X13 (ghost) · X2 |
| Rechnungen | nothing the row already says (amount and deadline are in its meta); a reminder line if dunned; then `PayStep` as **one line**, with its own controls as built: label „Bezahlt am“ · `DayField` (default today) · label „Betrag“ · amount field prefilled (10 ch wide) – no chips; the two labels are visible, `--text-meta`, `--text-3` | X9 „Bezahlt“ (secondary) · X2 |
| Abos | name · price / period; X16 „Kündigen bis Do 10. Dez.“; after a tap on „Gekündigt am …“: `DayField` (default today) and the foot's button becomes „Vermerken“ | X10 „Gekündigt am …“ (secondary) · „Läuft weiter“ (ghost) · X2 |
| E-Mail | line 1: sender name · day; line 2: subject (600); body: first 6 lines of the newest message, `--text-sm`, clamped, plain text; „Antworten“ opens mail's own compose dialog over the planner (as on the mail page) | X12 „Antworten“ (secondary); when the newest message is his: the text „Beantwortet?“ and the button „Erledigt“ instead · X2 |

Mail only: the bar „Wird gesendet … · Zurückziehen“ (`PendingSendBar`, 10 s) is mail's `planPageFoot` (contract in 4a), mounted once at the planner page's foot, so closing the row never hides it; mail wires the bar's `onReopen` to its compose dialog over the planner, so a reply withdrawn while the row is closed reappears with its text (test). A typed reply lives in mail's dialog and follows mail's own rules (a server draft only through its „Entwurf speichern“).

## States (mockup `04-states.html` shows each)

closed · loading · open · acting (button `aria-busy`, disabled) · done (the row fades and leaves; focus moves to the next row's title, or to the field when it was the last) · gone (X3 + X4) · unavailable (X5; mail on the phone X6) · error (X7 inside the panel).

## 1920 / 412

Per [00-common](00-common.md). On 412 the `PayStep` stacks: day field, amount, button full width (min-height 44 px). Mail is a desktop module: on the phone its panel is X5 + X6 and nothing else; in a narrow desktop window the body shows 4 lines.

## Edge cases

- The open row is ticked from the lead: the compartment closes with the row.
- The open row moves to another day (drag, `M`): it stays open on the new day.
- A sync round changes the thing while open: the panel re-reads (live query); a field he is typing in (amount) is never overwritten; no extra notice is added – the module's own form rules apply.
- A long list (60 items): 8 + „52 weitere“, each tap shows 8 more; no inner scroll.
- „Werte ausblenden“: amounts are placeholders in panel and toast.
- Print / copy: „Plan als Text kopieren“ never contains panel content (`copyInput` test grows by one case).

## Tests

- `RowCompartment.test.tsx`: one open at a time, Esc, focus return, selection mode.
- `PlanPanelHost.test.tsx`: lazy, boundary (a throwing panel shows X7, the sheet lives, the log holds module id and error name only), `accounts` never mounted, module off → X5.
- Per panel a component test with its states; invoices: paying from the panel writes what `PayStep` writes on the page and nothing in the planner (write spy).
- Write spy: opening and closing any panel writes nothing anywhere.
- e2e seed `e2e/seed/plan-expand.seed.spec.ts`: pay an invoice, tick two list items, tick a checklist line – without leaving `/planner`.
- `planner-hub-2.spec.ts` re-measured – 4a: D1 taps 15, perThing 9 (lasting price) and C1 workTaps 8, taps 20 (price until 5a), perThing 7 (lasting); 4b: B switches 3, doneInPlanner 5, rowsAfter 0, taps 28 / phone 16 and perThing 21 / 13 (price until 2); 4c: B (desktop) `replySwitches` 1 → 0, the other B figures unchanged (the mails enter through mail until package 2); the figure waits for mail's compose dialog.
