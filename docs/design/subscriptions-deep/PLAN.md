# Abos – „Tiefe & Politur“ (round 2026-11-tiefe)

Wish (Sven): „Abos auch mehr Übersicht, z. B. Tortendiagramm.“ Charts: `@/ui/charts` ([howto/charts.md](../../howto/charts.md)). Rules: [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md), [MODULE-IDENTITY](../MODULE-IDENTITY.md) v3.1, [DESIGN-SPEC](../DESIGN-SPEC.md) §4a.

## Ist

- One list, ordered by next charge; the head shows the month, a quiet line the year; „Teuerste Abos“ (top 3) only in „Erweitert“.
- Deadlines, price rises and the monthly equivalent are facts in each row's meta line; price history only inside the dialog.
- Widget „Nächste Abbuchungen“: due list with a summary line.

## Ziel

See where the money goes and what comes next without reading every row; act on a deadline in one tap. Nothing new for the AI cloud (`aiSchema` unchanged), no new notification.

## Pakete (stacked; each PR mergeable on its own in order)

| Package | Branch | Content | Data |
| --- | --- | --- | --- |
| p1 | `feat/subscriptions-overview-p1` | views „Abos | Übersicht“ (`?view=overview`); `Donut` per month by kind or by subscription (switch); „Nächste 30 Tage“ timeline with sum; „Was kostet mich das im Jahr“ (`Bars`, 8 + one sentence); list order „Datum | Kosten | Name“ (`?sort=`), by cost the row says „… im Jahr“; „Teuerste Abos“ goes (the ranking replaces it) | none |
| p2 | `feat/subscriptions-overview-p2` | „Kündigungsfristen“ card with „In den Plan“ (planner on; `plan.requested`, the plannable item of that deadline then steps back); „Preisänderungen“ card (vorher → nachher, % and per year); „Ungenutzt“ mark (dialog + row menu) with the yearly saving in the overview; widget summary: sum per month + next charge by name (no second widget: one per module is enough) | `plannedDeadline?`, `unusedSince?`; manifest v6; seed v3 (one price change, one unused) |

## Reihenfolge

p1 → p2. Charts are on `develop` (#934).

## Nicht geplant

Currency conversion (charts stay in the main currency and name the rest), cancelling from the app, usage tracking, a price forecast.
