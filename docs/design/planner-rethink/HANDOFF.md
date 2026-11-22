# Planner rethink – handoff for package 1 (`design:design-handoff`)

Package 1 changes the contract, not the room: the page looks as it does today, minus what the automaton needed, plus the tab that keeps missed things in sight. Model: [CONCEPT](CONCEPT.md) §1–§2; data: [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md); words: [CONCEPT-COPY](CONCEPT-COPY.md). Paths under `web/src/`. Everything not named here stays for packages 2–6 ([PACKAGES](PACKAGES.md)).

## 1. What is on screen after package 1

| Element | Today | After package 1 |
| --- | --- | --- |
| Tabs under the page head | none | `Tabs` (`@/ui`): „Plan“ · „Noch offen“; `?tab=open`; the tab is always there, a dot (`aria-hidden`) while it holds rows, name „Noch offen: Dinge von Mo, Di“ / „Noch offen“ |
| Tab „Noch offen“ | – | first group „Fest – braucht einen neuen Tag“ (the things that were fest, the maintainer's „marked and first“), then one group per passed day (`GroupedList`, head „Mo 16.“); each row says „war Mo“; each row = the existing `ThingRow` with its ⋯ menu („Verschieben …“ first); empty: „Nichts offen von früher.“ No group actions yet (package 3) |
| Day sheet rows | title, minutes, „fest“ on a pinned row, reason behind „Warum hier?“ | title, minutes, „fest“ on a locked row; **no** „Warum hier?“, no reason line, no „Teil 1/2“ unless parts exist |
| Row ⋯ | „Verschieben …“ pins; „Später“; „Nicht mehr festnageln“ | „Verschieben …“ moves (hint „Es liegt dann an diesem Tag. Sonst bewegt sich nichts.“); „Später“ = next day; „Nicht mehr fest“ on a locked row (the one-tap lock comes with package 2) |
| „Wartet auf freie Zeit“ | things the engine could not place, with the overload figure | „Noch ohne Tag“: things without a placement; folded as today; no figure of minutes |
| Field | new thing is spread by the run | lands on the day on the sheet, else today; a date in the text sets the day instead (no lock); toast „Liegt auf Do · Rückgängig“ |
| Toasts | „Eingeplant: Mi · X jetzt Do · 1 mehr“ | one fact: „Liegt auf Do“, „Erledigt“, „Vom Tag genommen“ – no second half, nothing else moved |
| Day figure | free = usable − planned, may read „voll“ | same; when planned > usable the existing line „… mehr als planbar“ (`t.planner` already has the wording for a day with more things than time); the calm line with the action comes with package 2 |
| „Rest verteilen“, „Tage einteilen“, sentences | preview from `plan()` over everything | preview from `propose()`: only the handed-over things move; head „Vorschlag – noch ist nichts verschoben.“ |
| Widget, calendar chips | from rows + last run | from the selector; unchanged look |

## 2. States of a row

| State | Look | Notes |
| --- | --- | --- |
| laid | as today | default |
| fest | chip „fest“ (existing `row.fixed` string, now for the lock only); a fixed block shows its time, not the word | text + (from package 2) icon, never colour alone |
| in „Noch offen“ | same row, meta „war Mo“ in the muted ink token | no warning tone, no red |
| without a day | row in „Noch ohne Tag“ | chips „Vorschlag …“ / „In ToDos …“ come with package 2 |
| thing done at its source | row gone at once (hidden by the selector) | no write |

## 3. Interaction

- Tab switch keeps the day on the sheet (`?day=` stays in the URL); Escape and browser back behave as for the calendar's tabs.
- „Verschieben …“ from the tab: the dialog's day chips start at today (the passed days are not offered); choosing a day moves the row, focus goes to the next row of the tab, one polite live message („Angebot liegt auf Do“).
- Undo: every action is one entry (`core/undo`), toast with „Rückgängig“ as today.
- Motion: none new; a row that leaves a list disappears in place (reduced motion: same).

## 4. Responsive

| Width | Change |
| --- | --- |
| ≥ 1024 px | tabs left-aligned under the head, above the field; context column unchanged |
| 412 px | tabs full width, two equal halves, ≥ 44 px high; the field's plus button stays; no horizontal scroll (`e2e/mobile-layout.spec.ts` gets the tab) |

## 5. Edge cases

- 0 missed things: tab without dot, empty text. 40 missed things (after a holiday): all rows, grouped by day, no fold and no count in package 1; the page scrolls (package 3 adds „Alle auf heute“).
- Long titles: wrap to two lines as today, minutes stay on the first line.
- A thing whose source is switched off: not shown; shown again when the source is back (the row was never deleted).
- A thing in parts from the engine's time: each part is its own row, „Teil 1/2“ counted from the live rows.
- First start after the update: the page renders after the migration finished (same gate as today's first run: skeleton rows, no flash of an empty plan).
- English UI: „Still open“ / „No day yet“ / „fixed“; strings in `strings.ts` + `i18n/locales/en/`.

## 6. Tokens and components

Reused only: `Tabs`, `GroupedList`, `ThingRow`, `RowChoice`, `PlanPreview`, `EmptyState` text line, `ui/tokens.css` ink and surface tokens (muted ink for „war Mo“, no new colour, no hex). New CSS: none expected beyond the dot (6 px, `--color-accent`, next to text).

## 7. Accessibility (from [CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md) §3, the part package 1 owns)

- Tabs: `role="tablist"`, arrow keys, the dot never the only signal (the tab's name carries the days).
- One live message per action; focus never jumps to the page top after a move.
- New page state `?tab=open` goes into `e2e/a11y.spec.ts`.

## 8. Tests package 1 owes

`core/plan/propose.test.ts` (determinism, stability under partial acceptance, `stay` untouched, fixtures S1–S6 rewritten) · invariants 1–4 of CONCEPT-MIGRATION §7 as `modules/planner/__tests__/staysPut.test.ts` (row snapshot per action; write spy over midnight / start / focus / sync / foreign edit; one undo entry per writing action incl. „Übernehmen“; a closed preview writes nothing; a throwing source, a switched-off module and a thing outside the listing window keep their rows) · convergence: move on A + lock on B → A's day, locked; remove on A + move on B → removed · `migration.test.ts` (every row of the §2 table on the U1 plan after its repair plus a pin three weeks ahead, second start writes nothing, restore runs it again) · ToDo helpers (mark without `prior`, disable keeps the date) · `e2e/usecases/planner-rethink.spec.ts` re-measured: U1 `unaskedAfterTwoDays` 0, `collateral` 0, `layCollateral` 0, `untraceable` 0, U2–U4 „ja“.
