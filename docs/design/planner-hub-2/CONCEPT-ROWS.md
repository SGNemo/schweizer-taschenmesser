# Planner hub 2 – concept: what a row can do (ideas 4, 2, 5)

Frame and link contract: [CONCEPT](CONCEPT.md). Looks and measures: [DESIGN](DESIGN.md), `handoff/`. Words: [COPY](COPY.md).

## Idea 4 – expand instead of jumping

**Behaviour.** (1) A tap on a row's title (Enter on the row) opens a compartment under the row; the title no longer navigates. (2) The compartment shows what the thing's own module mounts there – its **plan panel** – and ends with „Ganz öffnen“ (the old jump). (3) What he does in the panel is the module's own action with the module's own undo toast. (4) When the thing is done at its source, the row leaves with the board's next reading, as today. (5) One compartment is open at a time; opening another closes the first; Esc closes and returns focus to the title.

**Contract.** `contributions.planPanel?: () => Promise<{ default: ComponentType<PlanPanelProps> }>` with `PlanPanelProps = { id: string; compact: boolean; onDone?: () => void }`. Beside it `contributions.planPageFoot?: () => Promise<{ default: ComponentType }>`: one quiet strip a module may keep at the foot of the planner page, mounted once by the page through core (mail's „Wird gesendet … · Zurückziehen“ is the only one). `compact` = the one-line form used for a member inside a pile or a bundle: title, the source's `detail`, at most one end action that needs no further choice (an invoice: „Bezahlt“ – today, the full open sum, the module's undo toast, exactly what its list does in one tap; a ToDo: its tick; a subscription: none, its two choices need the full panel). Mounted only by `core/modules/PlanPanelHost` (lazy, Skeleton while loading, an error boundary that logs the module id and the error's name only – never its message). Switch „Zeilen aufklappen“ in the planner's settings (on; off = the title opens the thing as today). Rules on the type: reads and writes only the module's own data; the id is untrusted (unknown → the panel's own „Gibt es nicht mehr“); no network unless the person taps something that says so (mail „Senden“); never rendered for `accounts`. A module without a panel gets the core default: title, the source's `detail`, links, „Ganz öffnen“. A carrier ToDo (its first `origin` link is a mail thread) shows its target's panel first and its own checklist under it – the one case where the host mounts two.

| Panel | Shows | Lets him do | Package |
| --- | --- | --- | --- |
| ToDos | note (first 3 lines), checklist | tick checklist lines; „Erledigt“ is the row's tick | 4a |
| Listen | open items (≤ 8, then „n weitere“), sections as small headers | tick items; „Fertig eingekauft“ when none is open | 4a |
| Rechnungen | only what the row does not say already: a reminder line if dunned | the existing `PayStep` as one line: day, sum (`SensitiveValue` rules), „Bezahlt“ | 4b |
| Abos | name, price, deadline | the module's first cancel step: „Gekündigt am …“ (shows `DateChips` Heute · Gestern · Datum …, default Heute; writes the cancellation date) or „Läuft weiter“ (marks this one deadline as decided; the next period's deadline comes as usual). Either way the source no longer lists this deadline | 4b |
| Budgets (lines in the money pile, no row of its own) | budgets' own `compact` panel per budget over its frame: category, „40 € über dem Rahmen“ through `SensitiveValue` – the planner never holds the amount | nothing; the part's jump | 2 |
| E-Mail (desktop) | sender, subject, the newest message's first lines, rendered by mail from the device cache | „Antworten“ opens mail's own compose dialog over the planner, as on the mail page (review, „Senden“, „Entwurf speichern“ as built – nothing is saved or sent without his tap there); the bar with „Zurückziehen“ for the 10 s window is mail's `planPageFoot`, which also reopens the compose dialog with the withdrawn text (the bar's `onReopen`), so nothing typed is lost; the text „Beantwortet?“ with the button „Erledigt“ | 4c |
| Kalender (a blocker row) | time, place | idea 9's two proposals | 9 |
| Notizen, Merkliste, Unterlagen, Routinen | default panel (Routinen: its steps, 5a) | Merkliste: „Im Browser öffnen“ (its „Erledigt“ is the row's tick) | 4a |

**States.** closed · loading (Skeleton, 2 rows) · open · open and acting (the panel's button is busy) · gone („Gibt es nicht mehr“ + „Aus dem Plan nehmen“) · unavailable (module off or not on this device: „Auf diesem Gerät nicht verfügbar“, mail on the phone: plus „Mails beantwortest du am PC.“ as plain text) · error (the module's write failed: its message stays in the panel, nothing closed).

**Data.** None. The open row is page state (not stored; a reload closes it).

**Risk.** Mail content in the planner's DOM: it is rendered by mail's component, never passed through planner code, never in the planner's strings, search or copy path (`copyInput` test grows). A panel that throws must not take the sheet with it (boundary + test). Two ways to finish (row tick and panel) for ToDos: the panel has no „Erledigt“ of its own.

**Target (script).** Flow B: module switches 5 → 0, finished in the planner 1 → 10 of 10 (phone: 6, the four mails stay a desktop thing), handles 27 → 13 (phone 14 → 8), per thing 17 → 11 (9 → 7).

**Not part of it.** No second detail page, no editing of titles, dates or amounts in the panel (that is „Ganz öffnen“), no reply draft generated by anything, no panel in the week band, the 4-week grid or the widget.

## Idea 2 – collective rows (piles)

**Behaviour.** (1) Things from one area that wait without a day can stand as **one row**: „Finanzen checken · 3 Rechnungen · 2 Fristen · 1 Budget“, „E-Mails durchgehen · 4 warten“. (2) It is offered, not done: the first time an area has ≥ 3 single rows in „Noch ohne Tag“, a quiet line there says „6 Dinge aus Finanzen · Als eine Zeile zeigen“. His tap sets the setting `pileMoney`; the same switch is in the settings; the line is not shown again after ✕. The toast's „Rückgängig“ sets the switch back (an explicit inverse: the undo journal does not record settings). (3) The pile row behaves like any row: a day, „fest“, moving. It has no tick; its lead is the area's glyph. (4) Expanding it (idea 4) lists its parts: each member as a compact row with its own action or tick, each part with „In Rechnungen ansehen“ (a jump into the filtered view). (5) A member he gave a day or a lock himself stays a row of its own and is not counted. Folded members are not offered one by one by „Woche vorschlagen“ / „Rest verteilen“: the pile is the thing those proposals see. (6) When nothing waits, an unplaced pile is simply not there; a placed one reads „Finanzen checken · nichts wartet“ and is drawn like a done thing until its day passes (never „Noch offen“). Both are read from the count: a count that falls to 0 writes nothing in the planner.

**Contract.** `contributions.pile?: () => Promise<{ default: PileSource }>`; `PileSource = (ctx: { today: string }) => Promise<Pile[]>`; `Pile = { area: 'money' | 'mail'; id: string; count: number; label: (n: number) => string; to: string; due?: string; members?: string[] }`. `members` are item keys (`<module>:<id>`) of plannable rows the module owns or made (mail names the ToDos it created); they fold into the pile; a pile without members (budgets over their frame, the mail queue) is a count and a route. Core groups by `area`; the planner's own plan source (new with this package, [CONCEPT §0.1](CONCEPT.md)) hands them over as kind `pile`, id `pile-<area>`. Titles of the two areas are the planner's strings. Routes: `/invoices?view=open`, `/subscriptions?view=notice`, `/budgets?view=over`, mail: the queue route of `feat/mail-find-overview` – each param untrusted, an allow-listed word, read once and removed from the URL (pattern `invoices/returnTo.ts`).

| Module | Pile | Members |
| --- | --- | --- |
| Rechnungen | open invoices in the horizon, incl. those in „Frist vorbei“ | yes |
| Abos | cancellation deadlines within 14 days | yes |
| Unterlagen | deadlines within 14 days | yes |
| Budgets | budgets over their frame this month | no |
| E-Mail | the waiting queue (count + route; the queue is `feat/mail-find-overview`'s) plus ToDos made from a mail | the ToDos, by key |

„Frist vorbei“ (planner hub R2) stays as it is while the switch is off. With it on, the group's rows are members and the group is not drawn; the pile's meta carries „Frist vorbei“ as text.

**States.** offered · on (row unplaced / placed / fest) · expanded · nothing waits · a part's module off (that part is missing, said nowhere) · all parts off (no row).

**Risk.** A count is a figure that can grow: it is muted text in the meta, never a badge, never coloured, and falls as he works. Late money must not get quieter: „Frist vorbei“ stays in the pile's meta and the planner head's sentence is unchanged.

**Target (script).** Flow B: ten waiting things are 5 rows today (the budget and the four mails are none) → 2 rows that hold all ten (phone: 1); `rowsAfter` 1 → 0.

**Not part of it.** No pile for ToDos, lists or routines (lists are one row already), no notification, no count on the widget or the home screen, no automatic day for a pile.

## Idea 5 – bundles with one start point

Two things carry steps, and both look the same in the plan.

**5a · a thing with steps (the source owns them).** `PlannableItem.steps?: { id: string; title: string; done: boolean }[]` (≤ 40, display and „Los“ only, not part of the input hash) and `PlannableSource.onStepDone?(id, stepId, done)`. Sources: ToDos (checklist), Listen (open items), Routinen (today's steps). (1) The row shows „Haushalt · 5 Schritte“, later „· 2 von 5“. (2) Expanded, the steps are tick lines. (3) ⋯ and the panel offer **„Los“**: the focus page (`/planner/focus/:unit`) in step mode shows the title small, **the next open step large**, „Fertig · weiter“, „Überspringen“, „Pause“; on the last step the button reads „Fertig“ and also ticks the thing (its toast carries the undo); then „Alles durch.“ and „Zurück zum Plan“. (4) Typing „Haushalt: Wäsche anstellen, Spülmaschine ausräumen, Bad wischen“ in the field proposes „Bündel · 3 Schritte“ (idea 3's preview); Enter makes one ToDo with a checklist. (5) Panel ⋯ „Als Routine speichern“ sends `routine.requested { name, steps }` (exists) – one handle, toast with the routine's name.

**5b · a bundle of things (the planner owns the bracket).** (1) „Auswählen“ → tick rows → „Bündeln …“ → a name (prefilled with the first title) → one row „Wohnung · 4 Dinge“. (2) Members keep their home and their own „Erledigt“; in the bundle they are its steps, in the order ticked, sortable in the panel. Their own day rows are removed in the same action (they are on the bundle's day now); the undo restores every row. (3) „Auflösen“ puts each member on the bundle's day (or „ohne Tag“). (4) A member done or deleted elsewhere is a done / missing step; a bundle whose steps are all done is drawn like a done thing – derived at reading, nothing is written when a member changes elsewhere. (4a) A member that is a list shows its open items as tick lines right in the bundle's panel: that is the „Besorgungsrunde“ (idea 6). (5) „Los“ as in 5a; a member without a tick (an invoice) shows its panel as the step. (6) „Als Routine speichern“ only when every member is a plain task – a ToDo without an `origin` link (a ToDo made from a mail carries the subject as its title, and routines have a data API); titles only travel.

**States.** closed (n steps / k of n) · expanded · in „Los“ (step i) · paused · all done · a step gone · source off (the member is skipped, named in the panel).

**Data.** 5a none. 5b `planner_bundle`, `planner_item.bundle` / `.step` ([CONCEPT §0.1](CONCEPT.md)); the planner's own source lists bundles (kind `bundle`, key `planner:<record id>`, the id being `b_<uuid>`); a member with `bundle` set is not listed on the board while the bundle is alive, is left out of the run's inputs and of every proposal (its minutes count once, in the bundle's sum), and reads as planned on the bundle's day (`plannedDay`, the ToDos' plan state, mark M5).

**Risk.** Bundling moves members' rows: it is one named action with one undo (rule 1). Deleting a bundle never deletes a member. Two devices bundling the same thing: later tap wins, the other bundle shows one step fewer.

**Target (script).** C1 (today's best path is a routine made in another module): module switches 4 / 5 → 0, creating 12 handles → 1 line (with idea 3), `nextStepOnly` nein → ja; working through stays 7 handles (open the row, „Los“, five steps – the last step's button finishes the thing), one row as today. C2: rows 2 → 1, working 9 / 8 → 6; getting the round together costs 8 handles and one trip to Listen once (the list is in the plan only when asked in: `decisions/plan-sources.md`).

**Not part of it.** No nesting, no step durations, no automatic bundle, no „Los“ that starts by itself, no change to the start line or the goal line of „Tag kippt“ (they stay; a bundle can be the day's start point like any row).
