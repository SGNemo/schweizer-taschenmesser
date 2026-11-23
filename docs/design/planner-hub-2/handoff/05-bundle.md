# Hand-off 05 – bundles and „Los“ (packages 5a, 5b)

Concept: [CONCEPT-ROWS, idea 5](../CONCEPT-ROWS.md). Decision between two directions: [DESIGN §3](../DESIGN.md). Mockups: `../mockups/05-bundle-a.html` (chosen), `05-bundle-b.html` (rejected), `05-los.html`.

## Closed row

- lead: for a thing with steps the source's own lead (a ToDo keeps its tick); for a bundle (5b) the bundle glyph (three stacked lines), not a button.
- title: the thing's / bundle's title (expand button).
- meta: B1 („5 Schritte“, once one is done „1 von 5“ – k is the number of **done** steps) or B2; then the usual meta. No bar, no ring, no percent. („Los“ counts differently on purpose: „Schritt 2 von 5“ is the position of the step he is on.)
- ⋯ first entry: B3 „Los“.

## Expanded (panel of the steps)

```
 ○ Wäsche anstellen
 ● Spülmaschine ausräumen              (done: struck, --text-3)
 ○ Bad wischen
 ○ Müll rausbringen
 ○ Wäsche aufhängen
                                   [Los]   [⋯]   [Ganz öffnen]
```

- Steps are tick `PanelLine`s in order; done ones stay in place (struck), so the order never jumps.
- 5b: a member line has **one** lead column: the tick where the member takes one, else its source glyph (an invoice) – never both; `▸` at the end when it has a panel; drag handle on desktop hover / focus (`SortableList` from `@/ui`), „Nach oben / Nach unten“ in the line's ⋯ on the phone.
- Foot: B3 „Los“ (secondary) · ⋯ (B14) · X2 (5a only: opens the ToDo / list / routine).
- More than 12 steps: 12 + „n weitere“.

## „Los“ – the focus page in step mode (`/planner/focus/:unit?step=1`)

Reuses `FocusPage` (shell hidden, Esc leaves, the round survives a reload). Differences to the round of one thing:

| Zone | Content | Type |
| --- | --- | --- |
| eyebrow | B4 „Haushalt · Schritt 2 von 5“ | `--text-caps`, `--text-3` |
| centre | the step's title | `--text-2xl`, 600, max 20 ch per line, centred |
| under it | the elapsed clock „04:10“ (counts up, quiet; hidden by the existing „Uhr ausblenden“ switch) | `--font-num`, `--text-lg`, `--text-3` |
| actions | B5 „Fertig · weiter“ (the page's one filled button) · B6 „Überspringen“ (ghost) · B7 „Pause“ (ghost) | min-height 48 px, max 3 in a row |
| corner | „Zurück zum Plan“ (text link, as built) | – |

- No ring in step mode (a step has no minutes). No list of the other steps – **only the next one**.
- „Fertig · weiter“: the step's own done (`onStepDone`, or the member's `onDone`; a member without a tick shows its panel under the title and advances when the thing is done there), then the next open step fades in (opacity, `--dur`).
- After the last: B8 „Alles durch.“ + B9; „Erledigt“ ticks the carrying thing (5a) or closes the bundle (5b: nothing to tick when every member is done – then only „Zurück zum Plan“).
- Skipped steps: at the end B10; „Später“ returns to the plan with the steps open.
- 412: the same, actions stacked full width in the order B5, B6, B7.
- Keys: Enter = B5, `S` = B6, `P` = B7, Esc = back to the plan (the round keeps its place); one line under the buttons names them (`--text-meta`, `--text-3`), not drawn on touch devices.
- A step change is announced politely („Schritt 3 von 5: Bad wischen“); focus stays on B5.

## 5b: making and unmaking

- Selection bar (exists) gets B11 after „Verschieben …“; enabled from 2 rows. Dialog B12: one `TextField` (prefilled with the first title, selected), one `Checkbox` „Unterwegs (Besorgungsrunde)“ (hand-off 06), primary „Bündeln“. Toast B13.
- The bundle takes the day of the first ticked row (or „ohne Tag“ if none had one); minutes = sum of the members'.
- Panel ⋯: „Umbenennen …“, „Als Routine speichern“ (only if all members are plain tasks; toast B16), „Auflösen“ (toast B15).
- A line's ⋯: „Aus dem Bündel nehmen“ (the member is its own row on the bundle's day again).

## States

closed · k of n · expanded · sorting · in „Los“ · paused · all done · step gone (B17, struck, skipped by „Los“) · member's module off (B18, skipped) · empty bundle after the last member left (the bundle row is removed in that same action).

## Tests

- 5a: `steps` handed over by ToDos / Listen / Routinen (unit, per source); `onStepDone` round trip; steps never part of the input hash (`linksDisplayOnly`-style test); focus step mode: advance, skip, pause, reload mid-step, last step.
- 5b: bundle / unbundle are one undo each and restore every assignment (snapshot test of all planner rows before / after undo); a member with `bundle` set is not on the board; two-device merge of `bundle` / `step` (field LWW) converges; deleting a bundle deletes no member.
- Rule tests of planner rethink §7 extended to „Bündeln“, „Auflösen“, „Aus dem Bündel nehmen“, step ticks.
- e2e seed `e2e/seed/plan-bundle.seed.spec.ts`; `planner-hub-2.spec.ts` C1 re-measured.
