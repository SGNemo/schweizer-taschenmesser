# Finanzen – Tiefe & Politur (round 2026-11)

Maintainer ask: „Finanzen ist noch nicht richtig formatiert und könnte schöner sein.“

## Ist (develop, 2026-11-15; tour 1920/412, light/dark, medium seed)

- Overview: the breakdown line wraps inside an amount on the phone ("offene Rechnungen / −1.017,84 €"); "Ausblick" touches the card below it (no gap); the month's categories are drawn twice (ring with 5, bars with 6 – they disagree); three hand-made charts (`MonthCurve`, `CategoryRing`, `Charts.tsx` columns) beside the shared `@/ui/charts`.
- Year: amounts in the month table left-aligned (the `num` class never matched the CSS module); the two cards touch; "Wohin das Geld ging" a bare list.
- Buchungen (phone): on income rows the "⋯" falls to a line of its own under the amount.
- Konten: a plain list, no shape of the balance.
- Overview widgets: "Kontostand" context line is a long sentence that breaks mid-phrase; "Diesen Monat" puts "bisher ausgegeben" as a third weightless part.

## Ziel

Amounts right-aligned with tabular figures everywhere, lines break only between parts, every card spaced; one chart per question, all from `@/ui/charts`; account cards with their 6-month shape.

## Pakete (one branch + PR each, in order; p2 builds on p1, p3 on p2)

1. `feat/finance-polish-p1` – formatting: breakdown line, card gaps, year table alignment, booking rows, widget context lines.
2. `feat/finance-polish-p2` – charts: month curve `Trend`, categories `Donut` (one card instead of ring + bars), six months income/expenses `Trend` (two series), net worth `Trend`, year view `Trend` + `Donut`; the hand-made charts go.
3. `feat/finance-polish-p3` – Konten as cards with `Spark` (balance at each month's end, last 6 months).

Not here: budgets, subscriptions, invoices pages (own chats); `core/i18n/format` only if a bug shows (none found).
