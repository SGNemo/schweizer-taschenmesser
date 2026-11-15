# Planner hub – redesign concept (chat E)

2026-11-15 · input: [ANALYSIS-MEASURE](ANALYSIS-MEASURE.md) (P01–P28), [ANALYSIS-RESEARCH](ANALYSIS-RESEARCH.md) (T3–T6, P72–P83), [CONCEPT-LINKS](CONCEPT-LINKS.md) (L7, L10), [CONCEPT-SOURCES](CONCEPT-SOURCES.md) (§3.1, §3.2, §5). Texts: [CONCEPT-COPY](CONCEPT-COPY.md). Accessibility: [CONCEPT-A11Y](CONCEPT-A11Y.md). Mockups: `mockups/` (`render.mjs`); images on `shots/planner-hub`: `mockup-<a|b|c|a-empty|a-over|a-late|a-many|a-sheet>-<1920|412>-<light|dark>.jpg`. No product code; every decision is revisable (§8), the maintainer was not asked.

Scene (made up): Sunday 15 Nov 2026, today free; Monday nine things, 37 min free of 3 h 12; six invoices past their deadline; 16 things waiting.

## 1 Three directions

**A „Der Tag als Blatt“.** The page opens on the first day that holds things. That day is one large sheet: title 20/600, free time on a bar, fixed blocks as recessed rows, then „Zuerst“ (≤ 3) and „Danach“. Above it the field and the week as a band of seven tiles on one scale; right a context column: „Frist vorbei“, Termine, Nächste Fristen, a weather hint, the folded waiting group.

**B „Die Woche als Fläche“.** Seven columns with every day's real things; the picked day is 2.7 × as wide and shows full rows, the others compact rows. Field and the late group share the line above. Phone: the columns become pages that swipe sideways.

**C „Was jetzt?“.** One next thing as a large card with its action as the filled button („Bezahlt …“ · „Später“ · „Etwas anderes“), then the field, then the day's sheet in a reading column; the week is one folded line with seven small bars; no figure in the head.

| Question | A | B | C |
| --- | --- | --- | --- |
| Seen first | field, then the day with its three first things | the wide Monday among seven columns | the one next thing |
| Late things | own group, top of the context column (phone: one row above the day) | own group above the week, two columns | one folded row under the field |
| A thing | the one row (§4); full everywhere | the same row; compact (no chips, no ⋯) outside the picked day | the same row; the next thing a second, larger form |
| Emptiness | day sheet + context column carry the width | columns show every day; short days leave holes | reading column; side bands stay empty |
| Field | first element of the main column, three example chips | top left, half width | under the card (y 447) |
| Phone | band of seven tiles, one day, plus opens the field | pages per day, no week overview | card, then the day |

Measured on the mockups (dark, first screen, method of ANALYSIS-MEASURE):

| Measure | today (opens) | A | B | C |
| --- | --- | --- | --- | --- |
| Empty, 1920 / 412 | 71 % / 67 % | 15 % / 11 % | 46 % / 17 % | 38 % / 11 % |
| First thing row y, 1920 / 412 | none (236 / 328 after a tap) | 571 / 490 | 584 / 370 | 792 / 691 |
| Thing rows on screen, 1920 / 412 | 0 / 0 | 12 (6 of the day + 6 late) / 3 | 21 / 5 | 3 / 2 |
| Field y · size, 1920 | 567 · 924 × 44 | 193 · 1032 × 52 | 193 · 613 × 52 | 447 · 846 × 52 |
| Row height, 1920 / 412 | 48 / 56 | 64 / 64 | 64 (compact 56–90) / 72 | 64 / 64 |
| Targets < 44 px | 1 of 11 · phone 12 of 20 | 0 of 47 · 0 of 26 | 0 of 43 · 0 of 25 | 0 of 26 · 0 of 19 |
| Late rows | inside Monday | group x 1467, y 165 | group x 1048, y 165 | folded row y 559 |

## 2 Critique (skill `design:design-critique`), top 3 each

**A** – calm, full, one clear reading order. (1) The lead action of a money or list row is an icon without a word; folded in: the same outlined slot as the tick, tooltip, the word as first ⋯ entry and in the name – to be watched in the first use. (2) The first thing starts at y 571, after field, band and a morning block; folded in: no hint paragraph, tiles 76 px. (3) When only late invoices exist, the main column is an empty day and the work sits right; folded in: the head's context line and the day's sentence name the group.

**B** – the only one that shows the whole week's things; best for moving between days. (1) Six columns of ~176 px wrap titles to two lines and cut them („Wochenende…“): the „sehr klein“ complaint returns. (2) 21 rows and 43 controls with equal weight break „at most three main things first“; nothing says where to start. (3) The top line costs 250 px, short days leave 46 % empty, and the phone loses the week overview altogether.

**C** – the calmest, the best phone screen. (1) On a free day the card either pushes tomorrow's bill into the Sunday or stays empty; „Heute ist frei.“ and a filled „Bezahlt …“ contradict each other. (2) Only three thing rows on a 1920 screen, the week invisible, the field at y 447: not a hub. (3) The card is a second form of a thing beside the row, and a third „one next thing“ in the app (overview, ToDos).

## 3 Recommendation: A

A answers the complaint directly – the first screen goes from 71 % empty and no thing to 15 % and twelve rows – without giving up the calm rules: three things first, one figure, late things in one quiet place. It keeps one row form at full size, which the hub needs once shopping, training and bills arrive (B shrinks rows, C doubles them). Its parts map to what exists (`ItemRow`, `Progress`, `Card`), so the foundation is one package.

Taken from **C**: the first row of „Zuerst“ is the next thing (weight 600) and the head speaks about the next day that asks for something, not about „today“ only. Taken from **B**: one scale for all bars, counts on the tiles and, later if wanted, the week surface as a tab „Woche“ (D10).

## 4 Building blocks of A (concept level)

- **Head** (Identity 4.0 `standard`, no tabs): h1 „Planer“, ONE figure 600 (not 300) with a context line; desktop: page menu ⋯ and the gear; no filled button – the field's „Eintragen“ is the one filled action. Rule: §5.
- **Capture field** – first in the main column, 52 px, focused on arrival on the desktop, label „Eintragen oder sagen“, three example chips that fill the field (never submit). Phone: no inline field; the plus of the bottom bar („Ding“) opens the same field as a bottom sheet (`a-sheet`).
- **Week band** – seven equal tiles (phone: seven fit, nothing cut): day, count, free time, a bar whose track length is the day's capacity on the week's scale and whose fill is the planned share. Today `aria-current`, picked day a surface + outline, overbooked hatched. A tile picks the day.
- **Day sheet** – „Morgen · Montag, 16. November“, „37 Min frei von 3 h 12 · Warum?“ (one line that names blockers and the day's end, P80), the bar. Rows in day order: fixed blocks (appointment, training with its time) recessed; „Zuerst“ ≤ 3; „Danach · n“ – desktop five open, then „n weitere“; phone folded to one row. Foot: „Rest verteilen“, „Tage einteilen“ (always, not from 17:00). Overbooked: one neutral line with „Rest verteilen“.
- **Thing row – one grammar for every source:** lead slot 44 px, always filled · title 16/500 · meta 13: source icon **with** word („ToDo“, „Rechnung“, „Liste“, „Training“, „Abo“, „Routine“, „Termin“), detail, deadline · at most one chip line (links; more behind „Verknüpft“ in ⋯) · duration right · ⋯ 44 px, always visible. Lead: a tick where ticking is the source's own „Erledigt“ (ToDo, routine, training); an outlined action glyph for „Bezahlt …“, „Zur Liste“, „Kündigen …“ (L7: a route, the planner writes nothing); a clock without action for an appointment. States: default, next (600), block, late („Frist war So“), done (leaves, undo toast). The title opens the source's detail, not its edit form. ⋯ is grouped: „Verschieben …“ (day chips) · „Später“ · „Dauer …“ · „Mehr“.
- **„Frist vorbei“** – money past its deadline (later also cancellation dates, P86) leaves the days: an own group, sum in the head line, one danger-toned icon with the words; rows neutral, each with „Bezahlt …“. It takes no day time and „Rest verteilen“ never touches it. A late chore stays on its day with „Frist war Di“.
- **Context column** (26 rem; phone: only „Frist vorbei“ as one row above the day and the waiting group below it): Termine of the horizon, „Nächste Fristen“ (three), weather as one line of text, „Wartet auf freie Zeit · 16“ folded as decided.
- **Phone** – band, late row, the day; a swipe changes the day (tiles = tap alternative); „Danach“ folded; plus = „Ding“.

## 5 The head question

Neither „today“ nor „the week“: **the head reports the next day that asks for something**, and „what now“ is the first row of „Zuerst“. One figure, in this order: (1) today has open things → today's free time („1 h 20 frei“, „40 Min mehr als planbar“, „Für heute ist genug geplant.“), context „heute · 3 Dinge“; (2) else the next day with things → its figure, context „morgen, Mo. 16. · heute ist frei“; (3) only late money → „Heute ist frei.“, context „Frist vorbei: 6 Rechnungen“; (4) nothing → no figure. „Bald ist Tagesende.“ goes to the notice slot, never into the figure (P75). „Das reicht für heute.“ only with one thing (P13).

## 6 Target: before → after (A, mockup against ANALYSIS-MEASURE)

| Path | Today: taps · keys · screens · detours | A |
| --- | --- | --- |
| A tick a thing | 2 · 0 · 1 · 0 | 1 · 0 · 1 · 0 (opens on the day) |
| B move to Wednesday | 4 · 29 · 1 · 2 | 3 · 0 · 1 · 0 (⋯ → „Verschieben …“ → „Mi“; needs P09 fixed) |
| C open the source | 3 · 0 · 2 · 0 | 1 · 0 · 2 · 0 (chip or title) |
| D „Rest verteilen“ | 2, from 17:00 only | 2, any time; late group untouched |
| E enter a thing | 0 · 14; phone: field under the fold | 0 · 14; phone 1 · 14 (plus) |
| F settle a late invoice | 6 · 0 · 3 · 1 | 2 · 0 · 2 · 0 („Bezahlt …“ → confirm in the invoice) |

Density: §1; font sizes 6 → 6 at 1920 and 8 → 6 at 412. Not better: 13-px share of the text fragments (53 % → 53 %; meta stays the house size, titles gain weight and rows 16 px height) and the number of controls on the first screen (11 → 47); removed instead (focus checklist 9): seven week rows with their meta, the 136-character hint, the quarter-width panel, hover-only controls.

## 7 Friction resolved by A

P01, P13, P14 (weight; the figure stays in the title row), P74, P75 head · P02, P12, P72 late group · P03, P17, P18, P22, P76, P81 row · P04, P05, P27, P82 sheet and width · P06, P24, P25, P77, P83 field · P07, P15, P16 opening and empty state · P19, P20, P21, P28 band · P26 page menu · P80 „Warum?“ · P10 with S1. **Design only, needs function:** P08, P09 (the engine honours the pin), P73. **Partly:** P23 (waiting stays folded, in the context column). **Not here:** P11, P78, P79, P84–P86.

## 8 Decisions (all revisable)

| # | Decision | Why | Revisable how |
| --- | --- | --- | --- |
| D1 | Direction A | §3 | B stays possible as a tab (D10); C's card is one component away |
| D2 | **Revises** the split layout with week rows (0b-4b part 2, 2026-11-12): day sheet + band + context column | 71 % empty, things a tap away. Trade-off: the calm single list goes; the band is navigation with one number per day, not „a second picture of the week“ | `layout: 'split'` stays in the manifest; the sheet is its master |
| D3 | **Revises** „the field is the last row“ (UI-audit rule 4): first on the desktop; phone: plus + sheet | T6, 5 of 7 sources; costs 110 px above the things | one block to move; the research flagged a maintainer yes – recorded instead |
| D4 | **Keeps** „money rows without a tick“; the slot is filled by the action (L7) | rows alike, paying stays a money action | `onDone` per source |
| D5 | **Softens** „rest collapsed“: „Zuerst“ ≤ 3, „Danach“ five open on the desktop, folded on the phone | 1920 has the room; the three stay marked | a setting „Danach eingeklappt“ |
| D6 | Opens on the first day with things | P07 | constant |
| D7 | Late money leaves the days and the day sums | T3, L10 | flag in `board.ts` |
| D8 | Head rule §5; figure weight 600 | T4; DESIGN-SPEC §6 | strings only |
| D9 | Danger tone once (group icon), rows in words | focus rule „red only for overdue money“, least load | token |
| D10 | No tabs now; „Woche“ (B) later if wanted | one view first | `PageHeader views` |
| D11 | One word „Ding“ for plan things; `PageAction` short „Ding“ | audit: three words for one concept | strings |

Kept unchanged: waiting group folded, planner off by default, calm words, preview and undo.

## 9 Phases

1. **R1 foundation** (one package, planner files only): sheet, band, context column with Termine and the waiting group, row with the lead slot (tick, clock; the action slot renders once `action` exists), head rule, opening day, field first with chips, phone plus + sheet, states over / today / empty; states go into `Progress` and `ItemRow`, not into module CSS.
2. **R2**: „Frist vorbei“ (board and „Rest verteilen“ leave late money alone), „Verschieben …“ with P09, „Warum?“ line.
3. **K1b** (after R1): chip line through the resolver, `action` („Bezahlt …“, „Zur Liste“), „Nächste Fristen“.
4. **S1–S5** fill rows: „Einkaufen · 7 Dinge“, the training block (S4 after R1), cancellation dates into „Frist vorbei“.
5. Later: drop on a tile, tab „Woche“, weather.

## 10 Skills

- `design:design-critique` – on A, B and C: §2 with what was folded in.
- `design:ux-copy` – CONCEPT-COPY: 46 text rows de/en; „40 Min zu viel“ fell for the existing „40 Min mehr als planbar“.
- `design:accessibility-review` – CONCEPT-A11Y: 18 colour pairs, text passes in both themes; 10 findings, 3 major (action plate fixed in the mockup; bar track and row order go to the build).
- `frontend-design` – not installed in this session; worked without it.

## 11 Open, not waiting for anyone

The icon-only lead action needs a first-use check; the 13-px share did not fall. **Wartet auf Sven:** nothing – D2 and D3 revise decisions of the last ten days; look at those first.
