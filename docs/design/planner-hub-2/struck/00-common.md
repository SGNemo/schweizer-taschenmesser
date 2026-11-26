# Hand-off 00 – what every hub-2 surface shares

Read with the package's own hand-off. Words: [COPY](../COPY.md) (ids `M1` …). Keyboard and names: [A11Y](../A11Y.md). Mockups: `mockups/*.html` (the parked and struck ones; look only; the tokens below are the truth, the mockup CSS approximates them).

## The row as built (do not rebuild)

`ThingRow` (`web/src/modules/planner/components/ThingRow.tsx`) on `ItemRow` from `@/ui`: lead slot 44 × 44 (tick · action glyph · source glyph) → title → meta line (`--text-meta`, `--text-3`) → `below` (≤ 2 link chips) → end (minutes, „fest“ pill) → actions (lock, ⋯). Rows are separated by the list's hairline (`--border`); the day is one `Card`.

## New parts (each built once, used by several packages)

| Part | Where | What | First package |
| --- | --- | --- | --- |
| `PlanMark` | `core/entitylinks/PlanMark.tsx` | the mark M1–M6, a text link | 10b |
| Compartment | `planner/components/RowCompartment.tsx` | the box under a row that holds a panel | 4a |
| `PlanPanelHost` | `core/modules/PlanPanelHost.tsx` | lazy mount + boundary + default panel | 4a |
| `PanelLine` | `@/ui` (in `ListSurface.tsx`, additive) | one line inside a panel: optional tick, text, meta, **one action plus the expand button** (`▸`) – e.g. a compact invoice member: „Bezahlt“ (ghost) before `▸` | 4a |
| Step mode | `planner/routes/FocusPage.tsx` | „Los“ | 5a |
| Preview line, lead chips | `planner/components/Capture.tsx` (additive props) | K1 + K3 under the field; lead chips A2 / T11 before the input (rule below) | 3 / 9 / 11 |

**One slot, an order (field).** Lead chips stand before the input: A2 from „Vorbereiten …“, T11 while a topic filter is on; at most two, A2 first. The K1 preview line still shows under the field. Only a plain ToDo – also one with steps – takes the lead chips (A2 → link and day, T11 → topic). For every other kind (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) the chips are drawn struck through while K1 shows and are not applied. When a chip gives the day, K1 / the field's toast names that day.

No new token, no new colour, no new icon family. Glyphs come from `ui/icons.tsx`; a missing one is drawn in the same 24 px, 1.75 stroke grid and named in the PR.

## Measures and tokens

| Thing | Value |
| --- | --- |
| Compartment, desktop (≥ 701 px) | starts at the title's left edge (lead 44 px + `--space-3`), ends at the row's right edge; padding `--space-3` `--space-4`; margin-bottom `--space-3` |
| Compartment, phone (≤ 700 px) | full inner width of the card; padding `--space-3` |
| Chevron | none on a closed row; the open row shows one, 16 px after the title, `--text-3`, pointing down; on the desktop a closed title shows it on hover / keyboard focus only (not in the DOM otherwise) |
| Compartment surface | `--surface-2`, radius `--radius-md`, **no border, no shadow** (the stimulus budget counts both and holds them at 0) |
| `PanelLine` | min-height `--row-h` (44 px); text `--text-sm` / `--text`; meta `--text-meta` / `--text-3`; lines separated by `--space-1`, no hairline |
| Tick in a panel | the shared `Checkbox`, 22 px glyph inside a 44 × 44 target |
| Panel head (small) | `--text-caps`, 600, `--text-3`, margin-top `--space-3` (first: 0) |
| Panel foot | one row, at most 3 controls: the module's actions left (≤ 2; the main one `Button variant="secondary"`, others ghost), X2 „Ganz öffnen“ always last on the right; gap `--space-2`; phone: left-aligned, wraps. **Every action of a panel lives in its foot** – the body only shows and ticks |
| Filled primary | never inside a panel (the page's one filled button is „Eintragen“) |
| Money | always through `SensitiveValue` |
| Line length | panel text ≤ `--measure` (68 ch) |

## Motion

- Compartment content: opacity 0 → 1, `--dur-fast`, `--ease`. **No height animation** (motion is transform / opacity only); the rows below jump once, on his tap.
- A ticked panel line: the existing tick feedback, then the line fades (`--dur`) and leaves with the next reading.
- `prefers-reduced-motion`: the tokens are 0 ms; nothing else to do.

## States every surface has

loading (shared `Skeleton`, 2 lines, no spinner) · empty (one sentence, one next step) · many (cap + X19 „n weitere“; never a scroll box inside a row) · error (X7 in the place where he acted, `role="alert"`; what he typed stays) · module off (the part is not drawn, or X5 where he asked for it).

## Breakpoints

1920: the planner's two columns as built – the day's sheet left with „Noch ohne Tag“ as its foot; the right column holds „Frist vorbei“, „Termine“ and „Nächste Fristen“. 412: one column; row actions are in ⋯; the field is the page's last row. Nothing new changes the columns.

## Tests every package brings

Unit: pure logic of the package. Component: states above. e2e seed spec in a **new** file under `web/e2e/seed/` (protected specs only grow by appended `test(` calls). `npm run check:stimulus` unchanged. `web/e2e/usecases/planner-hub-2.spec.ts`: `IST` re-measured, never loosened. `web/e2e/a11y.spec.ts`: the new state in the planner's axe pass.
