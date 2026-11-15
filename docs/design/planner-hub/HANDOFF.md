# Handoff spec: planner page R1 "redesign foundation" (direction A „Der Tag als Blatt“)

Chat F · 2026-11-15 · skill `design:design-handoff` (ran). Code read at `origin/develop` `e10061c6b`; concept on `origin/design/planner-hub-redesign` (CONCEPT-DESIGN §4, §5, §8, §9 phase 1; CONCEPT-COPY; CONCEPT-A11Y), mockup `mockups/direction-a.html`, images `mockup-a-*` on `origin/shots/planner-hub`. Paths are under `web/src/` unless they start with `web/` or `docs/`; `P` = `modules/planner`; string keys are under `t.planner`.

## 1 Scope

The page opens on the first day that holds things and shows it as one sheet: field first, the week as a band of seven tiles, a context column beside it. R1 = planner files plus additive props in two shared parts (§4.0). No schema, engine or `core/modules/types.ts` change.

| Not in R1 | Package | R1 renders instead |
| --- | --- | --- |
| Group „Frist vorbei“, late money off the days and sums | R2 | late invoices stay rows of their day with „Frist war So“ in words; no group, no danger tone; head rule 3 cannot occur |
| ⋯ „Verschieben …“ (needs P09) · „Warum?“ line | R2 | ⋯ keeps „Später“ and „Festnageln auf <Tag>“; capacity text without the link (the row's „Warum hier?“ stays) |
| Chip line, `PlannableItem.action`/`links`, „Nächste Fristen“ | K1b | no chips (`e.link` stays in ⋯); a row without `onDone` shows its **kind icon** in the lead slot, no control; context column = Termine + waiting group |
| Weather, drop on a tile, tab „Woche“, new sources | later | nothing, no placeholder |

## 2 Layout (reading order = DOM order: field → band → sheet → context)

| Width | Structure |
| --- | --- |
| Wide: `useSplitView()` (page container ≥ 56 rem) | `SplitView`: main = capture, band, sheet (gap `--space-4`); `aside` = context column, width `--split-detail` (`clamp(22rem,30%,30rem)` – the mockup's 26 rem has no token and lies inside it), gap `--space-5`; page max `--page-wide` through `manifest.layout: 'split'` (unchanged) |
| 1024–1440 window | same; main shrinks to ≈ 600 px at 1280: tiles take the compact form by `@container` on the band (< 44 rem), not by window width |
| Not wide, > 899 px | one column: capture, band, sheet, Termine, waiting |
| Phone ≤ 899 px (`PHONE_QUERY`) | band (7 equal columns, gap `--space-1`, tile ≥ 56 px) → sheet → Termine → waiting; no inline field, the bottom bar's plus opens it (§4.7) |

Head: Identity 4.0 `standard`, sticky by the frame (`layout/AreaFrame`); nothing in the page is sticky; no `views`. Desktop title row: figure, page menu ⋯ (`RowMenu`, `head.menu`, today's `pageMenu` items), gear. Field at y ≈ 193 (1920).

## 3 Tokens (`ui/tokens.css`; no new token in R1)

- **Surfaces:** `--bg` page · `--surface-raised` sheet, cards, tiles · `--surface-2` picked tile, chips, hover · `--surface-sunken` block rows, bar track · `--surface` field.
- **Inks:** `--text` titles · `--text-muted` duration, source word, group heads, head context, „Frist war …“ (today `.dueWas` is `--warning`: remove) · `--text-3` meta. `--module-color` bar fill. `--border` hairlines between rows · `--border-strong` at full strength for tick, field and bar-track outlines (the mock's 70 % mix fails 1.4.11) · picked ring `--text` 1.5 px inset · `--focus`.
- **Type:** `--text-caps` · `--text-meta` (meta, group heads 600, tile meta, hints) · `--text-md` (titles, tile day, card heads) · `--text-xl` day title (phone `--text-lg`) · `--text-h1` · `--text-2xl` figure. Weights `--weight-medium` title, `--weight-semibold` next row, heads; block title 400.
- **Space/size:** `--space-1…5` (the mock's 6/10/14 px → `--space-2`/`--space-3`) · `--radius-sm` lead and ⋯, `--radius-md` tile, block, field, `--radius-lg` cards, `--radius-full` bar · `--touch`, `--icon-md`, `--icon-sm`, `--clamp-lines` · `--dur-fast`, `--dur`, `--ease-out`.
- **Mock values without a token:** row 4 rem → `min-height: calc(var(--row-h) + var(--space-4) + var(--space-1))` · field 52 px → `TextField`'s 44 · tile 76 px → content height · 26 rem → `--split-detail`. Remove the audit's literals (`8rem`, `1.5rem`, `2.75rem`, `40rem`).

## 4 Components

### 4.0 Into the shared parts (`ui/Patterns.tsx` + `Patterns.module.css`; additive, defaults unchanged)

| Part | Add | Why |
| --- | --- | --- |
| `Progress` | `over?: boolean \| 'hatch'` (pattern in `--module-color`; today `over` paints `--danger`) · `scale?: number` 0–1 (track length = capacity / week maximum) · track outline · `aria-valuetext` | D9, P20, P21, A11Y 2 |
| `ItemRow` | `controls?: 'hover' \| 'always'` · `weight?: 'next'` (title 600) · `recessed?: boolean` (sunken, no hairline, title 400) | P17, §4.5 |
| `ItemRow`, for K1b | `below?: ReactNode`, in the DOM before `end` and the menu, placed under the meta by grid (today `children` come after the menu) | A11Y 6; add now unused or leave to K1b – say which |

Delete from `P/routes/planner.module.css`: `.strip`/`.stripChip`, `.check` (→ `Checkbox tone="neutral" labelHidden`), `.column`/`.dayButton` (→ `Card`), `.weekLinkText` (→ `--link`/`--link-line`, `--touch`), `.addHint`, `.week`/`.weekBar`, `.dueWas`, `.blocker`.

### 4.1 Head figure – `P/head.ts` (new, pure) → `HeroFigure` in `HeroSlot area="figure"`, `testId="planner-head"`

`D` = first day with rows. First match wins:

| # | Condition | Figure | Context | Keys |
| --- | --- | --- | --- | --- |
| 1 | today has rows | free > 0: „1 h 20 frei“ · over: „40 Min mehr als planbar“ · else „Für heute ist genug geplant.“ | „heute · 3 Dinge“ | `head.free` (**text loses „heute“**), `head.over`, `head.full` · new `head.ctxToday(n)` “today · 3 things” |
| 2 | today empty, `D` exists | `D`'s figure as in 1; full: see §10 Q1 | „morgen, Mo. 16. · heute ist frei“ (later: „Mi. 18. · …“); phone: first half | new `head.ctxNext(day)` “tomorrow, Mon 16 · today is free”, `head.ctxNextShort(day)` |
| 3 | only late money | – | – | R2 |
| 4 | no rows | none (keep `.headPending` so the head height holds) | – | – |

`head.first` only as context when today holds exactly one thing (P13). `rest.dayEnd` moves to `HeroSlot area="notice"`. `identity.type: 'thin'` → `'sans'` in `P/manifest.ts` (§10 Q2). Read as one text.

### 4.2 Capture – `P/components/Capture.tsx` (new, from `entryRow`)

`TextField` (`add.label`; `add.placeholder` → „Was steht an?“ / “What is coming up?”; `error`) + `Button variant="primary" type="submit"` (`add.submit`). Below: new `add.examplesLead` „Zum Beispiel“ / “For example” + three `Chip`s, new `add.examples`: „Steuer 2 Std bis Do“ · „Donnerstag frei“ · „schieb Saugen auf Mi“ / “Taxes 2 h by Thu” · “Thursday off” · “move vacuuming to Wed”. `add.hint` is removed (de + en). Props `value, onChange, onSubmit, reading, error, autoFocus`. States: empty (button disabled) · reading (`readOnly`, `aria-busy`) · answered (`plan-say`, ask, `PlanPreview` right under it, unchanged) · error, new `add.error` „Das habe ich nicht gespeichert. Dein Text steht noch im Feld.“ / “That was not saved. Your text is still in the field.” (`addFromField` false). The ⋯ beside the field moves to the head.

### 4.3 Week band – `P/components/WeekBand.tsx` + css (new)

`role="group"` named `board.label`; seven buttons, `data-testid="week-<date>"`. Tile: day (`board.todayIs` on the wide form), `board.things(n)` (blockers not counted), state from `capacityShort` + new state `'over'` in `capacityState` (`P/components/capacity.ts`) → new `board.overShort(min)` „40 Min mehr“ / “40 min over”, `Progress scale over="hatch"`. Compact form: weekday + number, count or „frei“, bar. States: default · picked `aria-pressed` (`--surface-2` + ring) · today `aria-current="date"` + the word · off (empty track, `board.off`) · hover · focus-visible · pressed (`opacity`). Name, new `board.tileName`: „Morgen, Montag, 16. November: 37 Min frei von 3 h 12 · 9 Dinge“. Keys: one tab stop, ←/→/Home/End rove, Enter/Space picks, focus stays.

### 4.4 Day sheet – `P/components/DayPage.tsx` (new; **not** `DaySheet`: that file is the day-settings dialog, which stays)

`Card as="section"`, `aria-labelledby`, `data-testid="day-<date>"`, `data-today`, `data-off`. Header: `h2` `board.todayIs` / new `board.tomorrowIs` „Morgen · Montag, 16. November“ / later the date (`formatDay(d,'EEEE, d. MMMM')`); `capacityLabel(day)` as a text button that opens `DaySheet` (name new `board.editDay(day)` „Zeit für Montag ändern“ / “Change time for Monday”); full-width `Progress`. Body in day order: block rows → „Zuerst“ → „Danach“. Foot whenever the day has rows: links `rest.link`, `daySetup.open` (no 17:00 gate; `rest-link` id kept).

- **Groups:** two `ItemList`s, each under an `h3`: new `sheet.first` „Zuerst“ / “First” (first ≤ 3 rows in plan order, the first `weight="next"`), `sheet.then(n, min)` „Danach · 5 · 1 h 20“ / “Then · 5 · 1 h 20”. Desktop: 5 open, then `sheet.more(n)` „22 weitere“ / “22 more”; a fold never hides fewer than 2 rows. Phone: one button `sheet.thenFold(n)` „Danach · 5 Dinge“ / “Then · 5 things”. Folds: `aria-expanded`, `aria-controls`, ≥ 44 px.
- **Overbooked:** hatched bar, „40 Min mehr als planbar“, one line: `alert` icon in `--text-3` + new `sheet.overLine` „Der Tag hat mehr Dinge als Zeit.“ / “The day holds more things than time.” + `rest.link`.
- **Empty install:** `EmptyState title={t.planner.empty}` (`planner-empty`, motif `weekBars`) in the sheet; new `empty.next` „Schreib oben, was ansteht – oder tippe ein Beispiel an.“ / “Write above what is coming up – or tap an example.”, phone `empty.nextPhone` „Tippe auf das Plus.“ / “Tap the plus.”; `daySetup.open` as secondary button (`planner-days-setup`).
- **Free today, things later:** new `sheet.dayOffNext(day)` „Heute ist frei. Der nächste Tag mit Dingen ist Montag.“ / “Today is free. The next day with things is Monday.” · **empty picked day:** `sheet.emptyDay` „Für diesen Tag ist nichts geplant.“ / “Nothing is planned for this day.”
- **Loading:** `SkeletonRows`; field and band keep their boxes (P15).

### 4.5 Thing row – `P/components/ThingRow.tsx` (new, from `renderRow`) on `ItemRow controls="always"`

| Slot | Content |
| --- | --- |
| Lead 44 × 44, always filled | **tick** `Checkbox` 24 px drawn, `data-row-tick`, when `canDone(moduleId)`; name new `row.doneName(title)` „Erledigt: Wohnung saugen“ / “Done: vacuum the flat” · **clock** icon, no control (calendar blocker) · **kind icon**, no control (placeholder for K1b's action) |
| Title | 16/500, 2-line clamp, full text in `title`; `onOpen` → `navigate(e.to)` |
| Meta, fixed order | source icon 16 + word, new `src.<kind>`: `task` ToDo / To-do · `invoice` Rechnung / Invoice · `cancel` Abo / Subscription · `routine` Routine · `training` Training / Workout · calendar blocker Termin / Appointment · own blocker `row.blocker`; unknown → module name. Then block time (+ new `row.fixed` „fest“ / “fixed”) · `entry.detail` · part · `row.due` / `row.dueWas` · open reason. Separators `aria-hidden` |
| End · ⋯ | duration `--text-muted`. Menu via `RowMenuItem.group`: `row.later`, `row.estimate`, `row.dayPart`, then group new `row.more` „Mehr“ / “More” (pin, exclude, mark due, `asBreak`, `why`, `focus`, `open`, note/mail). `row.done` only where the lead is no tick. Name `row.menu(title)` |

States: default · next · block (`recessed`; calendar blockers have no ⋯) · late (words only) · done (fades, leaves; `markDone` toast with undo; focus → next lead) · hover (`--surface-2` on the main button) · focus-visible per control · pressed · disabled while `busy`. Swipes as today. Reads „Steuerunterlagen sortieren, ToDo, Frist Do, 35 Min“.

### 4.6 Context column – `P/components/Context.tsx` (new)

`Card` „Termine“ (`h2`, new `ctx.appointments` / “Appointments”): `day.blockers.filter(b => b.calendar)` of the seven days, row = clock, label, „Mo 09:30 · 1 h“; none → no card. Then today's `waitingBlock` unchanged (`GroupedList listId="planner"`). `aside` name new `ctx.label` „Rund um die Woche“ / “Around the week” (mockup text, not in CONCEPT-COPY).

### 4.7 Phone capture – `P/components/CaptureDialog.tsx` (new)

`usePageAction({ short: t.planner.add.short, onClick }, phone)` (`core/shell/pageAction`; new `add.short` „Ding“ / “Thing”; the shell names it `t.nav.plusThing` „Ding eintragen“) – not `<PageAction>`, which renders a head button on the desktop (§10 Q3). Opens `Dialog` with `Capture`: focus into the field, trap, Esc/scrim/swipe close, focus back to the plus; stays open after a plain entry. `?new=1` opens it on the phone, focuses the inline field on the desktop.

## 5 Interactions

| Action | Behaviour |
| --- | --- |
| Arrival | picked day = `?day=` → stored pick of the same calendar day → first day with rows → today. Field focus (`preventScroll`) on the desktop only, never on the phone |
| Pick a day | tile; phone also a horizontal swipe on the sheet (≥ 60 px, not started on a row); `role="status"` region says day + capacity |
| Tick | 1 tap, undo toast; the toast text also goes to the status region |
| Chip · Enter | chip replaces the field's text and focuses it, never submits · Enter: sentence → preview first, else `addFromField` |
| Stored (`core/db/metaKv`, device-local) | `planner.hub.day` `{ date, on }` (dropped when `on !== today()`) · `planner.hub.then.wide` / `.narrow` (fold of „Danach“) · waiting group as today. Not stored: „n weitere“, field text, open menu, preview |

## 6 Edge cases

Only late things → on their day (rule 2). 30+ things → 3 + 5 + „n weitere“, plain DOM. Long titles → 2 lines; tiles never break inside a word. No appointments → no card. Horizon: always `BOARD_DAYS` (7) from today; the rest waits (`wait.horizon`). „Werte ausblenden“: no money in the head; an amount in `entry.detail` goes through `SensitiveValue`. Reduced motion (`prefers-reduced-motion`, `data-motion='reduce'`): no fade. Text size „Sehr groß“ is **150 % = 24 px** in `tokens.css` (the concept says 20): everything in rem, band compact by container, no sideways scroll at 412. Light, dark, `forced-colors` (ring and outlines are real outlines). RTL: no.

## 7 Motion

Bar fill `scaleX` (`--dur-slow`, exists) · done row `opacity` (`--dur`, `--ease-out`) · day change `opacity` (`--dur-fast`) · dialog: its own. Transform/opacity only.

## 8 Accessibility (WCAG 2.1 AA; A11Y findings 2, 4, 6, 12, 13, 14 are requirements)

- **Contrast, both themes:** `--text-3` on `--surface-sunken` and on `--surface-2` (4.6, tight) · `--border-strong` outlines ≥ 3 : 1 on `--surface-raised` · fill on track · picked ring · focus ring.
- **Targets ≥ 44:** lead, ⋯, tiles, folds, text links, chips (32 drawn).
- **Order:** head menu → field → „Eintragen“ → chips → band (1 stop) → capacity → rows (lead → title → ⋯) → fold → foot → Termine → waiting.
- **Semantics:** `section` + `h2`, lists under `h3`, named `aside`; tiles `aria-pressed` + `aria-current="date"`; blocks never by colour alone; field error announced; status region for day and plan changes. Swipe has a tap alternative. Re-test with NVDA and TalkBack.

## 9 Acceptance, tests, checks

Sunday scene of `web/e2e/usecases/planner-hub.spec.ts` (lower `MAX`, never raise; assert the measures):

| Measure | Target (today) |
| --- | --- |
| Empty share, 1920 | ≤ 25 % (71 %) |
| Thing rows with their top above the fold, 1920 | ≥ 9 (0) – 3 + 6, needs the „never hide < 2“ rule |
| Field y, 1920 | ≤ 260 (567) |
| Targets < 44 px, 412 | 0 (12 of 20) |
| Path A · C1/C2 | 1 tap (2 · 3) |
| Font sizes | ≤ 6 – §10 Q4 |

**Update, never delete:** `P/__tests__/page.test.tsx` · `web/e2e/planner.spec.ts` („frei heute“ ×3, N01, S09 → field first, U01, phone strip → band, head menu) · `web/e2e/usecases/kopf-leer.spec.ts`, `wochenende.spec.ts` (W13, `week-`/`day-` ids, rest link). New: `head.test.ts`, band test (roving, names), ui tests for the new props. Guards that walk `/planner` and must pass untouched (`e2e/seed/**` is ratchet-protected): `head-height`, `layout-overflow`, `one-primary`, `a11y`, `touch-desktop`, `motion` (`.seed.spec.ts`).

**Stimulus ratchet** (`web/e2e/stimulus-budget.json`: `d1920--planner` buttons 32, icons 40, firstScreenActions 50, colouredAboveFold 7; `p412--planner` 17, 13, 30, 2): R1 raises `buttons`, `icons`, `firstScreenActions`, moves `height`; `borders`/`shadows` stay 0. A raise is a hit: numbers only from the CI job summary, label `stimulus-raise` and the maintainer's signed approval (`docs/howto/ci-stimulus-budget.md`, `ci-ratchet.md`, `ci-ratchet-signing.md`); name what went instead (seven week rows, hint, panel).

**Checks (in `web/`):** `npm run check` · `npm test` · `check:i18n` · `check:modules` · `check:docs` · `npm run e2e` · the hub spec (`build:e2e`, `preview`) · `npx playwright test e2e/a11y.spec.ts` · `check:stimulus` (look only) · `npm run change` · focus checklist (`docs/design/FOCUS-GUIDELINES.md`) and a decision bullet (D2, D3) in the PR.

## 10 Risks, open points, commits

| Risk | Handling |
| --- | --- |
| `PlannerPage.tsx`: 1008 lines, 15 commits in 5 days | commit 1 only moves code; merge `develop` once before the PR |
| Four specs and `page.test.tsx` pin the old structure | keep the test ids (`planner-head`, `day-`, `week-`, `rest-link`, `planner-empty`, `plan-say`, `planner-overload`); texts change with the strings |
| `Patterns.tsx` serves every list; `strings.ts` is a hotspot | additive props, own commit; append in the planner block only; `tokens.css` untouched |
| `SplitView`'s aside is absolutely positioned and scrolls alone | fallback: module grid `minmax(0,1fr) var(--split-detail)` |
| Stimulus budget; one-primary | §9; „Eintragen“ is the only `data-variant="primary"` in `main` |

To confirm (recommendation first):
1. **Rule 2, next day full:** the mockup's „Morgen ist voll“ is in no copy table. New `head.fullNext(day)` „Für morgen ist genug geplant.“ / “Enough is planned for tomorrow.”
2. **Figure weight:** concept 600; `HeroFigure` has `sans` 700 and `thin` 300. Take `sans`, no new variant.
3. **Identity 4.0 „one filled `PageAction` in the desktop head“** vs. D3/§4 „no filled button in the head“: `usePageAction` on the phone only; one decision bullet. No script demands `PageAction`.
4. **≤ 6 font sizes** fails with unchanged shared parts: `Chip` 14 px, `TextField` label and `Card` title 15 px → 8 with the new 20. Own `h2`s at `--text-md`, assert ≤ 8 (today's phone value); a size prop is a later ui package.

Contradictions settled: audit „`ItemRow tone="overdue"`“ vs. D9 → words only (the tone is a danger fill) · CONCEPT-COPY calls “Add or tell” and “Today is free.” existing, the catalogue has `add.label` “Add”, `head.dayOff` “Today is off.” → set the label, keep “off” · field 52 px vs. `TextField` 44 → 44 · context 26 rem → `--split-detail`.

Commits: (1) `refactor(planner)` extract `ThingRow`, `Capture`, menu · (2) `feat(ui)` `Progress`, `ItemRow` props + tests · (3) `feat(planner)` `head.ts`, strings de/en, `capacityState` over · (4) `feat(planner)` `WeekBand`, `DayPage`, `Context`, opening day, persistence, CSS cleanup · (5) `feat(planner)` field first, chips, error, phone plus · (6) tests, lowered `MAX` · (7) change note, decision; budget numbers from CI last.
