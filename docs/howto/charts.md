# Charts – which block when

Shared chart blocks in `web/src/ui/charts/` (import from `@/ui/charts`, not from `@/ui`: pages without a chart do not load them). SVG and plain boxes, no library. Live demo with every state: `/dev/components` → "Diagramme" (dev server, Dev-Preview, E2E build). Decision: [ui-shell](../decisions/ui-shell.md) "Shared charts".

| Block   | Shows                                                          | Use for                                                            | Not for                                       |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `Donut` | parts of a whole, ≤ 6 named + "Sonstiges", sum in the middle   | where the money went, cost per subscription                        | values over time, negative values             |
| `Bars`  | values side by side from zero, optional target mark (`target`) | budgets (Soll/Ist), categories (`horizontal`), months (`vertical`) | parts of a whole (Donut), long series (Trend) |
| `Trend` | one or two series over labels, optional `compare` period       | balance, spending per month, this year vs last year                | ≤ 2 points (say it in a sentence)             |
| `Spark` | shape only, no axis                                            | a widget or a row next to its number                               | anything people must read values from         |

## Rules the blocks keep (do not rebuild them in a module)

- **Never colour alone:** the visible legend names every slice/series with its value; donut slices carry a pattern each, series differ by line style (solid, dashed, dotted). Screen readers get the title, a summary sentence and a hidden table with every value; the drawing is `aria-hidden`.
- **Colours:** first series `--viz-1` (= module hue inside a module, grey in "Ruhig"), slices are steps of it, second series `--viz-2`, comparison and "Sonstiges" `--border-strong`. **Red only for over target** (`Bars`), always with icon and "… drüber".
- **Numbers:** `format` (default `formatNumber`); money: `format={(c) => formatMoney(c, currency)}`, axis `formatAxis={formatMoneyAxis}`. Amounts → `sensitive`: "Werte ausblenden" masks every amount, shapes and shares stay.
- **Width:** container queries, not the viewport: legend beside or under the donut, bars stack their label at ≤ 24 rem, axis labels thin out (the newest always shows). Give the chart its card's width; no fixed pixel sizes.
- **States:** no usable value → `emptyText` (default "Noch keine Werte."); one value → full ring, one bar, a dot; many values → "Sonstiges", thinned labels, no values over more than 7 columns.
- **Motion:** only on first appearance, transform/opacity, off with "Bewegung reduzieren" (system or app).

## Examples

```tsx
<Donut title={t.finance.byCategory} data={rows.map((r) => ({ id: r.id, label: r.name, value: r.amountMinor }))} format={money} sensitive />
<Bars title={t.budgets.month} data={budgets.map((b) => ({ label: b.name, value: b.spent, target: b.limit }))} format={money} sensitive />
<Trend title={t.finance.trend} labels={months} series={[{ label: t.finance.income, values: income }, { label: t.finance.expense, values: expense }]} compare={{ label: t.finance.lastYear, values: lastYear }} format={money} formatAxis={formatMoneyAxis} sensitive />
<Spark values={last6} label={t.widgets.kpiSeries} />
```

`title` is the accessible name and table caption; `showTitle` prints it when the card has no heading of its own. A missing feature (grouped bars, a highlighted column, a tooltip) goes to the charts owner, not into a module copy.
