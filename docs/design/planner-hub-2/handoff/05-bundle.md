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
- Foot: B3 „Los“ (secondary) · ⋯ (B14; this is where „Als Routine speichern“ is: two handles – for a ToDo only when it is a plain task without an `origin` link; lists and routines as they are) · X2 (5a only: opens the ToDo / list / routine).
- `▸` on a member line and `▾` on a list member are buttons named X1.
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
- On the last open step the filled button reads B23 „Fertig“: it finishes the step, ticks the carrying thing (5a) and **returns to the plan** with the thing's toast („Erledigt.“ + undo). No end page. 5b: after the last member the same return, nothing to tick – the bundle is done when its members are.
- Skipped steps: at the end B10; „Später“ returns to the plan with the steps open.
- 412: the same, actions stacked full width in the order B5, B6, B7.
- Keys: Enter = B5, `S` = B6, `P` = B7, Esc = back to the plan (the round keeps its place); one line under the buttons names them (B19, `--text-meta`, `--text-3`), not drawn on touch devices.
- A step change is announced politely („Schritt 3 von 5: Bad wischen“); focus stays on B5. A member step without a tick has no B5: focus goes to its panel's first control, and the letter keys work only while focus is not in a text field.

## 5b: making and unmaking

- Selection bar (exists) gets B11 after „Verschieben …“; enabled from 2 rows. Dialog B12: one `TextField` (prefilled with the first title, selected), primary „Bündeln“, the shared „Abbrechen“. Toast B13.
- A member that is a list is open inside the panel: its open items as tick lines (the lists panel's body, max 8 + „n weitere“), `▾` folds it. In „Los“ a list member is one step that shows these tick lines under its title.
- The bundle takes the day of the first ticked row (or „ohne Tag“ if none had one); minutes = sum of the members'. While it lives, a member's own assignment rows (also one written later on another device) are ignored by board, run, proposals and `plannedDay`: the bundle wins.
- „Bündeln …“ is only in the selection bar, never in a row's ⋯.
- Panel ⋯: „Umbenennen …“, „Als Routine speichern“ (only if all members are plain tasks; toast B16), „Auflösen“ (toast B15).
- A line's ⋯: B20 „Aus dem Bündel nehmen“ (the member is its own row on the bundle's day again), on the phone also B21 „Nach oben“ / „Nach unten“.

## States

closed · k of n · expanded · sorting · in „Los“ · paused · all done (derived: drawn as done, nothing written) · step gone (B17, struck, skipped by „Los“) · member's module off (B18, skipped) · empty bundle after the last member left (the bundle row is removed in that same action).

## Tests

- 5a: `steps` handed over by ToDos / Listen / Routinen (unit, per source); `onStepDone` round trip; steps never part of the input hash (`linksDisplayOnly`-style test); focus step mode: advance, skip, pause, reload mid-step, last step (B23 ticks the thing and returns to the plan); „Als Routine speichern“ not offered for a ToDo with an `origin` link.
- 5b: bundle / unbundle are one undo each and restore every assignment (snapshot test of all planner rows before / after undo); a member with `bundle` set is not on the board and its own assignment rows are ignored by run, proposals and `plannedDay`; two-device merge of `bundle` / `step` (field LWW) converges; device A bundles X while device B moves X to Thursday → X is in the bundle, shown on the bundle's day, „Auflösen“ puts it there; deleting a bundle deletes no member.
- Rule tests of planner rethink §7 extended to „Bündeln“, „Auflösen“, „Aus dem Bündel nehmen“, step ticks; write spy: a member done or deleted in its own module writes nothing in the planner's tables.
- e2e seed `e2e/seed/plan-bundle.seed.spec.ts`; `planner-hub-2.spec.ts` re-measured – 5a: C1 (create 11 / phone 10, work 7, taps 18 / 17, perThing 7, switches 2, `nextStepOnly` ja); 5b: C2 (rows 1, `oneRow` ja, create 14 / 13, work 6, perThing 7, switches 2), with `rows` and `oneRow` read after the bundle exists.
