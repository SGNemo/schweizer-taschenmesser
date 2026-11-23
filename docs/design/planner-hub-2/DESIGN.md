# Planner hub 2 – design: building blocks, the two decisions, critique

Mockups: `mockups/*.html`, rendered by `mockups/render.mjs` (1920 and 412, light and dark; pictures in the PR text). Hand-offs: `handoff/`. Words: [COPY](COPY.md). Keyboard: [A11Y](A11Y.md).

## 1. Building blocks (Identity 4.0: nothing new in the system unless named here)

| Need | Uses what exists | New, and why |
| --- | --- | --- |
| Row | `ItemRow`, `ThingRow`, `RowMenu`, `Checkbox`, `Chip`, `SensitiveValue` | the title becomes a `button` (was a link) – same count of controls |
| Compartment | `--surface-2`, `--radius-md`, `--space-3/4` | `RowCompartment` (planner) – a surface under a row did not exist; no border, no shadow, no new token |
| Lines inside | `Checkbox`, list type scale | `PanelLine` in `@/ui` – `ItemRow` is too heavy inside a row (no menu, no swipe, no hairline) |
| Mounting a module's panel | lazy contributions, error boundary of widgets | `PlanPanelHost` (core) – the one place that mounts foreign UI in the planner |
| Mark | text link, planner glyph | `PlanMark` moves from ToDos to `core/entitylinks` |
| Dialogs, chips, selection | `Dialog`, `DateChips`, `SelectionBar`, `SortableList`, `TextField` | – |
| „Los“ | `FocusPage`, `core/focus` session | a step mode of the same page – no second focus surface |
| Preview under the field | `Capture`, the examples' slot | prop `preview` – the slot is reused, the block does not grow |
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
- Against: on 1920 it takes the column of „Noch ohne Tag“ / „4 Wochen“ exactly while he works off things that come from there; on 412 it is a sheet over the plan – a second place with its own close, which is the jump he wanted gone; two grammars to build, test and keep accessible.
- Critique folded in: the desktop picture now shows the lost column, because the first draft made B look free.

**Decision: A.** His order was „aufklappen statt hinspringen“, and on the phone B is a jump. A costs one layout shift that he causes himself; the caps keep it small. B's only real gain – room for mail – matters on the one device where „Ganz öffnen“ is a keystroke away.

## 3. The bundle – two directions, one decision

**A · „Eine Zeile, ‚Los‘ auf der Fokus-Seite“** (`05-bundle-a.html`, `05-los.html`): closed, a bundle is one row with „1 von 5“ as text; expanded, its steps are tick lines; „Los“ opens the focus page with only the next step.

- For: a round is one row whether it is typed, bundled or a routine (C2: 2 → 1), and it is worked through without a module switch (C1: 4 / 5 → 0); „Los“ reuses the page that already hides everything else and survives a reload; nothing new on the sheet.
- Against: the steps are invisible until he opens the row; „Los“ leaves the sheet (not the module).
- Critique folded in: member lines have one lead column (tick or source glyph – the draft had both, ragged); „k von n“ counts done steps on the row and the position in „Los“, said in the hand-off; a member without a tick shows its panel as the step.

**B · „Block mit sichtbaren Schritten, ‚Los‘ an Ort und Stelle“** (`05-bundle-b.html`): the bundle is a header row with its steps always visible beneath; „Los“ turns the header into a stage inside the sheet.

- For: he sees all steps without a tap; he never leaves the sheet.
- Against: it shows every step as a row (six rows where A shows one); the stage competes with every other row of the day while he should see one thing; the header row carries a fifth control.

**Decision: A.** B fails principle 1 by its own picture, and „‚Los‘ zeigt nur den nächsten Schritt“ is only true when nothing else is on screen.

## 4. Critique of every other surface (first impression · what was changed · what stays weak)

| Surface | First impression | Changed after critique | Stays weak (said in the hand-off or the PR) |
| --- | --- | --- | --- |
| Mark (10) | quiet, findable in the meta line | drops the module's second meta item before it wraps | in a list of 20 the marks are slow to scan – by intent (stimulus); the planner is the place to scan |
| Pile (2) | ten rows become two; the meta carries the facts | phone meta is „6 Dinge · Frist Fr“ (three wrapped lines before); nested member panel lost its box (a hole in dark mode); mail ToDos are members | the offer line is easy to miss – it is meant to be declinable, and the switch is in the settings |
| „Los“ (5) | one large title, one filled button | keys named under the buttons; step change announced | much empty space at 1920 – that is the point of the page |
| Share (1) | one card, one choice, one button | targets are a column on 412; page title and empty text stay as built | a long shared title makes the new row three lines tall |
| Kinds (3) | the line reads like a sentence | only „Wird:“ is muted (was grey on grey); on 412 it stands above the field | two lines above the keyboard on 412 when „Als Aufgabe eintragen“ wraps |
| Errand (6) | stops read top to bottom | after the council: places and map struck (no figure); what stays is the list ticked inside the bundle (5b) | the drawn version with places is kept for a later „ja“ |
| Appointment (9) | two quiet buttons where he already looks | lead chip reuses the preview slot | the recessed blocker row is weak among 20 rows (as built); the chips carry the relation |
| Topic (11) | 20 rows against 7 is the whole argument | the page head carries the filter (a line above the sheet plus a head figure for the whole day confused); „Alles zeigen“ once | a topic is invisible on the row by design – he finds it in ⋯ „Verknüpft“ |
| Waiting (7, struck) | the row is gone, which is the wish | – | the folded line at the end of a long „Noch ohne Tag“ is easy to overlook; the thing returns by itself, so nothing is lost |
| Duration (8) | „· wie zuletzt“ is nearly invisible | – | that it is a guess is hard to see – one more reason it is struck |

## 5. FOCUS checklist for the round ([FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md); each package answers it again with figures)

1. **Stimulus:** no new always-visible control except the pile offer, which exists until it is answered; rows fall (flow B 5 → 2, C2 2 → 1, A1 11 → 7); budget files unchanged.
2. **Off switch:** piles, kinds in the field and expanding rows have switches; steps, bundles and topics exist only when he makes them.
3. **Next step:** each panel has at most one secondary action; „Los“ has one filled button.
4. **Wording:** COPY, checked; counts are plain text and fall as he works.
5. **Interruption:** „Los“ and the topic filter survive a reload; an open compartment does not (nothing is lost by that).
6. **Tested:** lists in the hand-offs.
7. **Readability:** panel text ≤ 68 ch; no colour without text.
8. **Clicks:** counted in [ANALYSIS](ANALYSIS.md) per flow.
9. **What goes instead:** the „Frist vorbei“ group (while the money pile is on), the ToDos-only `PlanMark`, the own „im Plan“ texts of bookmarks and subscriptions, the title link's jump as the default, five rows per household round.
