# Budgets – „Tiefe & Politur“: charts

**Ist (develop, 2026-11-15):** head figure „Frei“, month switch, one card per limit (bar, „noch …“, forecast line only when it lands above the limit), goals tab. No chart; the widget shows the fullest limits and the goals as bars.

**Ziel (Sven: „Budgets gerne grafischer mit Grafen“):** only `@/ui/charts` (no chart of our own).
- Above the cards: „Noch je Tag“ (free of the monthly limits ÷ days left, today included) and „Prognose Monatsende“ (sum of the monthly limits' forecasts), both only for the running month, each with a context line; `Bars` spent vs. limit per limit (red only for the part over the limit, done by the block).
- Below the cards: `Trend` of the last 6 months (spending in categories with a limit; the limit per month as grey comparison line), `Donut` of all of the month's spending per top-level category (via `finance/public.ts`, unchanged).
- Each card: „noch X € je Tag bis …“ in its note line.
- Widget: `Spark` of the last 6 months under the rows (size m/l).
- Empty view: an example `Bars` with three made-up limits.
- Off switch: module setting „Diagramme über den Limits zeigen“ (default on).

**Pakete:** one (`feat/budgets-charts`): the parts depend on the same loader (`data.ts` `loadInsights`) and are small; a split would leave a page with half its charts.

**Reihenfolge:** pure maths + tests (`insights.ts`) → loader → page + widget → e2e → stimulus budget → docs.
