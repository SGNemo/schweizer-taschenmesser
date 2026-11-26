# Planner hub 2 – design: building blocks, the two decisions, critique

Mockups and hand-offs of the built packages were removed when the round closed (git history before package M; what was built: [decisions/plan-hub-2](../../decisions/plan-hub-2.md)); the parked and struck ones are in [`struck/`](struck/PROMPTS.md) (`struck/mockups/render.mjs`). Words: [COPY](COPY.md). Keyboard: [A11Y](A11Y.md).

## 1. Building blocks (Identity 4.0: nothing new in the system unless named here)

| Need | Uses what exists | New, and why |
| --- | --- | --- |
| Row | `ItemRow`, `ThingRow`, `RowMenu`, `Checkbox`, `Chip`, `SensitiveValue` | the title becomes a `button` (was a link) – same count of controls |
| Compartment | `--surface-2`, `--radius-md`, `--space-3/4` | `RowCompartment` (planner) – a surface under a row did not exist; no border, no shadow, no new token |
| Lines inside | `Checkbox`, list type scale | `PanelLine` in `@/ui` – `ItemRow` is too heavy inside a row (no menu, no swipe, no hairline) |
| Mounting a module's panel | lazy contributions, error boundary of widgets | `PlanPanelHost` (core) – the one place that mounts foreign UI in the planner |
| Mark | text link, planner glyph | `PlanMark` moves from ToDos to `core/entitylinks` |
| Dialogs, chips, selection, days | `Dialog`, `DateChips`, `DayField` (pay step, cancel step), `SelectionBar`, `SortableList`, `TextField`; the share page's `CaptureForm` as built | – |
| „Los“ | `FocusPage`, `core/focus` session | a step mode of the same page – no second focus surface |
| Preview under the field, lead chips | `Capture`, the examples' slot | prop `preview` – the slot is reused, the block does not grow; lead chips (A2, T11) stand before the input |
| Folded lines | the fold of „Nächste Wochen“ | – |
| Colour | `--text`, `--text-3`, `--accent` for quiet buttons, module hue only on the tick | none; no topic colours, no kind colours, no count badge |
| Icons | `ui/icons.tsx` | a bundle glyph (three lines) and a chevron if the set has none – same grid, named in the PR |
| Motion | `--dur-fast`, `--dur`, `--ease` | none; never height |

Identity: the planner keeps hue `indigo`, head `standard`, no filled action in the head; the page's one filled button stays „Eintragen“ (in „Los“: „Fertig · weiter“).

## 2. The expanded row – two directions, one decision

**A · „Fach unter der Zeile“** (`04-expand-a.html`): the compartment opens directly under the row, inside the day sheet.

- For: the thing stays where his eyes are; one grammar on 1920 and 412; nothing covers the plan; keyboard order is the reading order.
- Against: the rows below jump once per opening; a tall panel (mail, a long list) pushes the day off the screen.
- Critique folded in: every action sits in the panel's foot (the first draft had „Antworten“ in the body and „Ganz öffnen“ below it); the invoice panel no longer repeats amount and deadline and its pay step is one line; lists cap at 8 lines, mail at 6.

**B · „Seite daneben“** (`04-expand-b.html`): the row is marked, its panel opens in the right column (1920) or as a bottom sheet (412).

- For: the list never moves; more room for a mail; looks tidy on the desktop.
- Against: on 1920 it takes the right column – „Termine“ and the deadline groups („Frist vorbei“, „Nächste Fristen“) – while a row is open, exactly while he works off things that come from there; on 412 it is a sheet over the plan – a second place with its own close, which is the jump he wanted gone; two grammars to build, test and keep accessible.
- Critique folded in: the desktop picture now shows the lost column, because the first draft made B look free.

**Decision: A** (confirmed by the maintainer 2026-11-23). His order was „aufklappen statt hinspringen“, and on the phone B is a jump. A costs one layout shift that he causes himself; the caps keep it small. B's only real gain – room for mail – matters on the one device where „Ganz öffnen“ is a keystroke away.

## 3. The bundle – two directions, one decision (built as 5a; the bundle of things, 5b, is parked)

**A · „Eine Zeile, ‚Los‘ auf der Fokus-Seite“** (`struck/mockups/05-bundle-a.html`; `05-los.html` removed when the round closed): closed, a bundle is one row with „1 von 5“ as text; expanded, its steps are tick lines; „Los“ opens the focus page with only the next step.

- For: a round is one row whether it is typed or a routine (and bundled, should 5b be built: C2 2 → 1), and a round is worked through without a module switch (C1: 4 / 5 → 2 with 5a, 0 once it is typed in the field, package 3); „Los“ reuses the page that already hides everything else and survives a reload; nothing new on the sheet.
- Against: the steps are invisible until he opens the row; „Los“ leaves the sheet (not the module); bundling an errand round with a shopping list costs 14 handles (phone 13) once and per thing 5 → 7, and the module switches stay 2 (the list is asked into the plan in Listen) – it buys one row less and 9 / 8 → 6 working handles.
- Critique folded in: member lines have one lead column (tick or source glyph – the draft had both, ragged); „k von n“ counts done steps on the row and the position in „Los“, said in the hand-off; a member without a tick shows its panel as the step.

**B · „Block mit sichtbaren Schritten, ‚Los‘ an Ort und Stelle“** (`05-bundle-b.html`, removed when the round closed): the bundle is a header row with its steps always visible beneath; „Los“ turns the header into a stage inside the sheet.

- For: he sees all steps without a tap; he never leaves the sheet.
- Against: it shows every step as a row (six rows where A shows one); the stage competes with every other row of the day while he should see one thing; the header row carries a fifth control.

**Decision: A** (confirmed by the maintainer 2026-11-23); it holds for 5a – „one row, ‚Los‘ on the focus page“ for a thing with steps. Direction A's bundle of several things (5b) is parked by the figures (2026-11-24). B fails principle 1 by its own picture, and „‚Los‘ zeigt nur den nächsten Schritt“ is only true when nothing else is on screen.

## 4. Critique of every other surface (first impression · what was changed · what stays weak)

| Surface | First impression | Changed after critique | Stays weak (said in the hand-off or the PR) |
| --- | --- | --- | --- |
| Mark (10) | quiet, findable in the meta line | drops the module's second meta item before it wraps | in a list of 20 the marks are slow to scan – by intent (stimulus); the planner is the place to scan |
| Pile (2) | ten rows become two; the meta carries the facts | phone meta is „6 Dinge · Frist Fr“ (three wrapped lines before); nested member panel lost its box (a hole in dark mode); mail ToDos are members | the offer line is easy to miss – it is meant to be declinable, and the switch is in the settings |
| „Los“ (5) | one large title, one filled button | keys named under the buttons; step change announced | much empty space at 1920 – that is the point of the page |
| Share (1) | the page as built, its form already set to the planner | no new target list, no day chips, no new button – the form's own „Speichern“; two quiet lines say where it lands and that the link goes with it | a long shared title makes the new row three lines tall |
| Kinds (3) | the line reads like a sentence | only „Wird:“ is muted (was grey on grey); on 412 it stands above the field | two lines above the keyboard on 412 when „Als Aufgabe eintragen“ wraps |
| Errand (6) | stops read top to bottom | after the council: places and map struck (no figure); the list ticked inside the bundle is parked with 5b | the drawn version with places is kept for a later „ja“ |
| Appointment (9) | two quiet buttons where he already looks | the lead chip stands before the input, the preview keeps its line (hand-off 03) | the recessed blocker row is weak among 20 rows (as built); the chips carry the relation |
| Topic (11) | 20 rows against 7 is the whole argument | the page head carries the filter (a line above the sheet plus a head figure for the whole day confused); „Alles zeigen“ once | a topic is invisible on the row by design – he finds it in ⋯ „Verknüpft“ |
| Waiting (7, struck) | the row is gone, which is the wish | – | the folded line at the end of a long „Noch ohne Tag“ is easy to overlook; the thing returns by itself, so nothing is lost |
| Duration (8, built on the maintainer's decision) | „· wie zuletzt“ is nearly invisible | – | that it is a guess is hard to see – the row says „wie zuletzt“, and only a new thing gets it |

## 5. FOCUS checklist for the round ([FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md); each package answers it again with figures)

1. **Stimulus:** new and always visible, completely: the pile offer (until it is answered); the mark (one text link per planned row in ten modules); one chip in a row's existing chip line (S7, A4); the steps meta on ToDos with a checklist and on routines (text in the existing meta line); the pile lead glyph (and the bundle's, should 5b be built; in the lead slot that is always filled). Expected `check:stimulus` effect: text only, no new control – unchanged; each package still runs it; rows fall (flow B 5 → 2, A1 11 → 7, D4 20 → 7; C2 2 → 1 only with the parked 5b); budget files unchanged.
2. **Off switch:** piles, kinds in the field and expanding rows have switches; steps, bundles and topics exist only when he makes them.
3. **Next step:** each panel has at most one secondary action; „Los“ has one filled button.
4. **Wording:** COPY, checked; counts are plain text and fall as he works.
5. **Interruption:** „Los“ and the topic filter survive a reload; an open compartment does not (nothing is lost by that).
6. **Tested:** lists in the hand-offs.
7. **Readability:** panel text ≤ 68 ch; no colour without text.
8. **Clicks:** counted in [ANALYSIS](ANALYSIS.md) per flow.
9. **What goes instead:** the „Frist vorbei“ group (while the money pile is on), the ToDos-only `PlanMark`, the own „im Plan“ texts of bookmarks and subscriptions, the title link's jump as the default.
