# Hand-off 08 – measured duration (struck by principle 1; build only on the maintainer's „ja“)

Concept: [CONCEPT-STRUCK, idea 8](../CONCEPT-STRUCK.md). Mockup: `../mockups/08-duration.html`.

## Structure

- No new control. A new thing whose key has ≥ 2 records shows its minutes as D1 „20 Min · wie zuletzt“ in the row's end slot (same type as minutes; „· wie zuletzt“ in `--text-3`) until its minutes are set by hand.
- „Dauer …“ (the existing choice 5 / 15 / 30 / 60): one line above the chips, D2 „zuletzt 20, 25, 15 Min“, `--text-meta`, `--text-3`.
- Settings (Planer): switch D3 „Aus gemessener Zeit vorschlagen“ (on), quiet button „Gemessene Zeiten löschen“ (confirm, one undo).

## States

no record (30 as today) · one record (30; D2 shows „zuletzt 20 Min“) · ≥ 2 (median of last 5, rounded to 5, min 5) · switch off (no D1, D2 stays) · 412: D1 shortens to „20 Min“ with the full text as the accessible name.

## Tests

Key function (source id before title; normalisation = `pastePlan`'s); cap and median; pruning inside the recording action; nothing existing changes (snapshot); `planner_measure` in no export, copy text, data API or assistant schema (`exclusion`-style test).
