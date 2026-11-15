# Rechnungen – „Tiefe & Politur“ (round 2026-11-tiefe)

Wish (Sven): „Rechnungen auch gerne Tortendiagramm.“ Charts only from `@/ui/charts` ([howto/charts.md](../../howto/charts.md)). Rules: [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md), [FOCUS-WORDING](../FOCUS-WORDING.md), [MODULE-IDENTITY](../MODULE-IDENTITY.md) (Identity 4.0 head: one figure), [DESIGN-SPEC](../DESIGN-SPEC.md) §4a.

## Ist

- Tabs Offen · Bezahlt · Alle; open view grouped by time (the "Überfällig" group head is red); head figure = open sum with "n überfällig · n Rechnungen".
- Pay one at a time (button, swipe, menu) with "Rückgängig"; no search, no batch, no picture of where the money goes.
- Mail → Rechnung and "Mahnung vermerken" exist (mail and planner side) – not touched here.

## Ziel

A calm overview: what is open, what has passed its date, what was paid this month; where the money goes (payee); how much was paid per month. Lists stay the everyday tool and get search and a batch "bezahlt" with undo. No schema change.

## Pakete (stacked: p2 starts from p1)

| Package | Branch | Content | Data |
| --- | --- | --- | --- |
| p1 | `feat/invoices-overview-p1` | tab „Überblick“: two figures beside the head's open sum (Frist vorbei · bezahlt diesen Monat), `Donut` by payee (offen / bezahlt switchable), `Bars` paid per month (12 months); head context adds "bezahlt im <Monat>"; pure logic `overview.ts` + tests | none |
| p2 | `feat/invoices-overview-p2` | lists: search (payee, reference, note), "Frist vorbei" as its own calm section on top of the open list (warning tone, red only on the badge), selection mode with "Als bezahlt markieren" for many + one "Rückgängig"; widget gets a `Spark` of the paid months at size l | none |

## Entschieden

- Donut by **payee** only: invoices have no category field; adding one is a schema change for a second view – listed as open in the PR.
- Several currencies: charts use the currency most invoices have; a quiet line names how many were left out.
- Overview is its own tab, so the open list (everyday) does not grow; the head keeps one figure (Identity 4.0).

## Nicht geplant

Categories, links invoice ↔ mail (Planer-Zentrale chat), budgets per payee, notifications.
