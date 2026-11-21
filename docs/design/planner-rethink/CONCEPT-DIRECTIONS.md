# Planner rethink – three directions, critique, accessibility

Part of [CONCEPT](CONCEPT.md). Mockups: [`mockups/`](mockups/) (`a.html`, `b.html`, `c.html`; render with `node ../docs/design/planner-rethink/mockups/render.mjs` from `web/`, 1920 and 412 px, light and dark; pictures in the PR text). All three share the model (§1–§7 of the concept) and the words; they differ in the surface.

## 1. The directions

| | A – Blatt und Band | B – Wochenbrett | C – Monatsblatt |
| --- | --- | --- | --- |
| Main surface | the day as a sheet (as today), the week band above it pages; a switch shows four weeks instead of the band | seven columns side by side, things as cards; a tray on the left for „Noch offen von …“ and „Noch ohne Tag“ | a four-week grid with titles in the cells; the day opens beside it |
| More than a week | page the band; „4 Wochen“ grid with one load mark per day | page week by week; open a second week below | native |
| Missed | group on top of today's sheet | tray, always visible | group in the day panel; past cells dimmed |
| Moving | drag onto a band tile or grid day; menu; `M` | drag between columns is the main way; menu | drag between cells; menu |
| Phone (412) | sheet + band as today; grid by switch | days stacked, long | cells show a number only; the panel below |
| Lock, overbooking | lock on every row; one warm line on the day, „+ 2 h 10“ on the tile | chip on the card; line in the column head | lock in the panel; „+ 2 h 10“ in the cell |

**A – for:** it keeps the planner hub's sheet, band and one figure (decisions D2/D3, stimulus budget), so the rebuild changes the contract and not the room; the phone is the same surface; the four-week view costs nothing until asked for. **Against:** laying out a whole week means changing the day on the sheet or dragging onto small tiles; only one day's things are readable at once. **Mitigation:** drop targets get the full tile, the day pick is two taps from every row, multi-select moves several at once.

**B – for:** laying is spatial and direct, the week is readable at a glance, drag feels natural. **Against:** 20–30 cards and seven capacity lines at once – the stimulus load the planner hub removed (`ANALYSIS-MEASURE` P02) comes back; cards with a 44-px lock and menu get two lines high, so a column shows five things; on the phone it collapses into a long list where drag is the weakest way. It would also undo D2 („sheet, band and context column replace the week rows“) a fortnight after it shipped.

**C – for:** „more than a week“ is the surface itself; deadlines weeks ahead are visible. **Against:** 28 cells with titles break „one figure in the head“ and the stimulus budget; cells cut titles; the phone shows numbers only, so the main surface there is the side panel anyway; it duplicates the calendar module's month view, which already carries the plan chips.

**Recommendation: A**, with B's drag (band tiles and grid days as drop targets) and C's grid as the „4 Wochen“ switch. It reaches every target of the concept (§9) with the least new stimulus and the least rework of what the planner hub measured.

## 2. Critique folded in (`design:design-critique`)

| Finding (first drafts) | Severity | Change made |
| --- | --- | --- |
| A: the missed group competed with today's rows for the first glance | moderate | the group sits on a muted surface, folds after three rows on the phone (seven on the desktop), has no figure in its head |
| A: „Verschieben …“ as text on every missed row crowds 412 px (title wraps to two lines) | moderate | phone: the row keeps lock and ⋯; the day pick is the first entry of the menu and the swipe-left action |
| A: band tiles at 412 px carry three lines of 11-px text | moderate | phone tile: weekday, date and the load bar; the figure only for the day on the sheet and for an overbooked day |
| A/C: a lock on every row is 3–10 extra icons | moderate | open lock in muted ink, filled lock in the accent together with the word „fest“; FOCUS item 9: the row's „Warum hier?“ and the reason line go (nothing was decided for him) |
| B: capacity in every column head reads as seven warnings when a week is full | critical | not fixable without hiding what the board is for – one reason against B |
| C: „+ 1“ in a cell hides the thing he is looking for | critical | cells show a count, not titles, in A's grid |
| All: the overbooking line looked like an error | minor | warning tone on a soft surface, no icon, sentence without „zu viel“; the action is a link, not a filled button |
| All: a preview must say that nothing has happened yet | minor | fixed head „Vorschlag – noch ist nichts verschoben.“ |

**FOCUS checklist** (direction A): 1 stimulus – adds the lock per row and at most one group; removes reason lines, „Warum hier?“, the waiting group's overload figure and every move toast („X jetzt Do“). 2 off switch – „Neues automatisch vorschlagen“ (off by default); the missed group folds. 3 next step – „Alle auf heute“ is the one plain action of the group. 4 wording – [CONCEPT-COPY](CONCEPT-COPY.md). 5 interruption – nothing is half-applied: a preview that is closed changed nothing. 6 tests – packages 1–6 name them. 7 readability – lock = icon + word; overbooking = text + tone. 9 removed instead – see 1. 8 clicks – concept §9.

## 3. Accessibility of direction A (`design:accessibility-review`, WCAG 2.1 AA)

Design-stage review of the mockup and the interaction plan; 0 critical, 4 major, 4 minor – all become acceptance points of the packages named.

| # | Issue | Criterion | Severity | Requirement |
| --- | --- | --- | --- | --- |
| 1 | Drag is the visible way to move | 2.1.1, 2.5.7 | major | every drag has a single-pointer and keyboard equal: „Verschieben …“ in the row menu (first entry), `M` on a focused row, arrow keys + Enter in the grid (package 5) |
| 2 | The lock is an icon-only toggle | 4.1.2, 1.1.1 | major | `button` with `aria-pressed`, name „Fest an diesem Tag: Arzt anrufen“; state also as the word „fest“ (package 2) |
| 3 | A move changes two places at once (row leaves, tile figure changes) | 4.1.3 | major | one polite live message per action („Angebot liegt auf Do“), the undo toast stays reachable; focus goes to the next row, never to the page top (packages 3, 5) |
| 4 | Band and grid days are buttons with visual load only | 1.3.1, 4.1.2 | major | name carries date, load and state („Donnerstag, 19. November: 2 h 10 mehr geplant, als Zeit ist · 3 Dinge“); the day on the sheet has `aria-current="date"`; the grid is a `grid` with row/column headers (package 4) |
| 5 | Overbooking in warning tone | 1.4.1, 1.4.3 | minor | never colour alone (text „… mehr geplant …“); warning text on its soft surface ≥ 4.5 : 1 in both themes – measured in `e2e/readability.spec.ts` (package 2) |
| 6 | Past days dimmed with opacity | 1.4.3 | minor | dim by the muted ink token, not by opacity, so text stays ≥ 4.5 : 1 (package 4) |
| 7 | Targets: lock, ⋯, paging arrows, grid days | 2.5.5 | minor | ≥ 44 × 44 px; grid days at 412 px are 52 × 44 (7 across with 6-px gaps) – `e2e/touch-hit-phone.spec.ts` gets the grid (package 4) |
| 8 | Long press to drag on touch | 2.5.1 | minor | never the only way (see 1); a long press that is cancelled changes nothing (package 5) |

Keyboard plan: Tab order field → view switch → paging → days → missed group (actions, rows) → day rows → „Noch ohne Tag“; inside a row Tab reaches tick, title link, lock, menu. Escape closes a dialog or preview without a change. Reduced motion: a moved row appears in place, no fly-over.
