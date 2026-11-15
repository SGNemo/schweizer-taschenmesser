# Planner hub – design-system audit (chat C)

2026-11-15 · `develop` @ `6ef3a2cb` · skill `design:design-system`, audit mode. Part of [ANALYSIS-MEASURE.md](ANALYSIS-MEASURE.md) (numbers, critique, friction table P01–P28); split off for the size budget.

Scope: the planner's building blocks – thing row, day card, head, chips, bars, capture field – in `web/src/modules/planner/routes/planner.module.css` (259 lines), `focus.module.css`, `widgets/WeekWidget.module.css` and the components, against `web/src/ui/tokens.css` and `@/ui`. Paths below are under `web/src/`; `planner.module.css` and `PlannerPage.tsx` lie in `modules/planner/routes/`.

## Summary

**Blocks reviewed:** 6 (+ preview, text link) · **Issues:** 26 (4 naming, 15 token, 7 copies) plus the missing states · **Score:** 72 / 100. Token discipline is high: no hex, no literal font size, weight, radius or shadow colour in the module CSS. The loss is in **states** (overbooked, today, loading, error are missing or carry no style) and in **four local copies** of shared parts. A redesign should add states to shared components, not more module CSS.

## Naming consistency

| Issue | Where | Recommendation |
| --- | --- | --- |
| One day, four names: `.column` (the day card), `.dayButton`, `.week` / `.weekRow` (week sheet), `.strip` | `planner.module.css:42, 61, 35, 173, 121` | `day`, `dayHead`, `weekList`, `dayStrip` |
| `.weekLink` / `.weekLinkText` also carry „Rest verteilen“ and „Tagesende festlegen“ | `planner.module.css:240`, `PlannerPage.tsx:866`, `components/DaySetup.tsx:222` | `quietLink`, or a shared text-link button |
| `.reason` styles the overload figure too | `PlannerPage.tsx:744` | own class, or `--text-3` on the element |
| „Ding“, „Sache“ („Eine Sache reicht“), „ToDo“ for one concept in the page's texts | `strings.ts:8456, 8636, 8588 ff.` | one word (hand-over to the wording chat) |

## Token coverage

| Category | Tokens used | Hard-coded values found |
| --- | --- | --- |
| Colours | all (`--text-3`, `--surface-*`, `--warning`, `--module-color`, `--accent`) | 0 hex/rgb. **Wrong token:** a link in `--accent` (`planner.module.css:251`; rule B7: `--link` + `--link-line`); `--border` as a frame (`:212`; rule: hairline between rows, never a frame) |
| Typography | `--text-meta` (4 ×), `--weight-semibold/medium` | 0 sizes. `text-underline-offset: 0.2em` (`:254`). The head is drawn with `--weight-light` 300 (`ui/identity/HeroFigure.module.css:41`, asked for at `PlannerPage.tsx:856`) although DESIGN-SPEC §6 allows 400/500/600/700 |
| Spacing / size | `--space-1…4`, `--space-hair`, `--touch`, `--row-h` | `width: 8rem` bar (`:40`) · `1.5rem` tick (`:93–94`) · `6rem` (`:198`) · `8rem` (`:202`) · `min-height: 2.75rem` instead of `--touch` (`:247`) · `40rem` container breakpoint (`:23`) · negative margin `calc(-1 * var(--space-2))` (`:236`) · `11.5rem` ring (`focus.module.css:23–24`) · `min-height: 44px` instead of `--touch` (`widgets/WeekWidget.module.css:8`) |
| Borders / radius | `--radius-md/lg`, `--border`, `--border-strong` | `1px` twice (`:151` inset line copied from the shared chip, `:212`) |
| Shadows / motion | none needed | 0 |

71 declarations of `planner.module.css` use a token; 14 literals in three files.

## Component completeness

| Block | Built from | States present | Missing | Score |
| --- | --- | --- | --- | --- |
| Thing row | `@/ui` `ItemRow` + local tick | default, hover, focus, swipe, „Warum hier?“ | **overdue** uses a local text colour (`.dueWas`, `:113`), not `ItemRow tone="overdue"`; no done state (the row vanishes); no kind marker; row without tick has no lead; blocker = colour only (`:106`) | 6 / 10 |
| Day card | local `.column` + `.dayButton` | off (`:57`), hover (`:76`), panel variant (`:52`) | `data-today` is set (`PlannerPage.tsx:686`) and styled nowhere; **overbooked**; empty (a bare head); loading; own focus style (global outline only) | 5 / 10 |
| Head | `@/ui/identity` `HeroFigure` | free, over, full, no time, day off as text; pending placeholder (`:2`) | a state for „tomorrow is full“; tone for over; the weight | 6 / 10 |
| Chips (phone strip) | local `.stripChip` | pressed (`:146`) | hover; `aria-current="date"` (today) unstyled; overbooked; scroll hint | 5 / 10 |
| Bars | `@/ui` `Progress` | fill | `over` and `tone` exist and are never passed (`PlannerPage.tsx:696, 937`): an overbooked day looks full; no common scale; empty track nearly invisible (dark `#1f2529` on `#1b2126`) | 5 / 10 |
| Capture field | `@/ui` `TextField`, `Button`, `RowMenu` + local row | disabled, read-only while reading (`aria-busy`), answer line | **error** (a failed entry only puts the text back, `PlannerPage.tsx:382`); focus on arrival; own hint paragraph beside `TextField`'s (`:12`) | 7 / 10 |
| Preview | local `.preview` | busy | a framed box on `--surface` instead of `Card` / `--surface-raised` (`:206–215`) | 6 / 10 |

Docs: none of the local blocks is described in `docs/design/` (the shared ones are, in DESIGN-SPEC §7).

## Local copies of shared components

| Local | Shared part it repeats | File:line |
| --- | --- | --- |
| `.stripChip` (+ pressed look „as the shared chip“) | `Chip` / `Segmented` (`ui/Patterns.tsx:562`) | `planner.module.css:128–152` |
| `.check` on a native `<input type="checkbox">` | `Checkbox` (`ui/Fields.tsx`), which `ItemRow` itself uses for `selectable` | `planner.module.css:91`, `PlannerPage.tsx:647` |
| `.column` raised card around a `ListSurface` (surface in surface on the phone) | `Card` / `ListSurface` | `planner.module.css:42–59` |
| `.preview` | `Card` | `planner.module.css:206` |
| `.addHint` | the hint of `TextField` | `planner.module.css:12` |
| `.weekLinkText` | the app's link style (`--link`) / `Button variant="ghost"` | `planner.module.css:246` |
| `.sheetRow`, `.weekRow`, `.stepper` | `SettingRow` | `planner.module.css:158–179` |

## Priority actions

1. **States into the shared parts, then use them:** `capacityState` gets „over“; `Progress` gets `over` and one scale; `ItemRow tone="overdue"` (or a group) replaces `.dueWas`; today and overbooked get a look on day card and chip. (S–M; closes P02, P20, P21 of the friction table.)
2. **One row grammar for every source:** a lead slot that is always filled – the shared `Checkbox`, a „Bezahlt“ action or a kind icon – with a 44-px hit area, instead of the local 24-px tick. (M; P03, P18.)
3. **Replace the four copies** (`stripChip`, `preview`, `column`, `weekLinkText`) with `Chip`/`Segmented`, `Card`, `ListSurface` and the link style, and turn the nine size literals into tokens (`--touch`, a bar-width token). (S; removes roughly 60 lines of module CSS and the `--accent` link.)
