# Hand-off 07 – „Warte auf Antwort“ (struck by principle 1; build only on the maintainer's „ja“)

Concept: [CONCEPT-STRUCK, idea 7](../CONCEPT-STRUCK.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/07-wait.html`.

## Structure

- Row ⋯ → W1 (group „Mehr“; only for sources with `onWait`).
- `Dialog` W2: `DateChips` with an additive `presets` prop (its presets are fixed today) for „3 Tage · 1 Woche · 2 Wochen“, plus `DayField` for „Datum …“ (default 1 Woche); below, optional „Von wem?“: a combobox over people's names (people on; else the field is not drawn). A mail link on the row is shown as a fixed line („Mail: Nebenkosten 2025“) and needs no choice. Primary „Warten“ → toast W6.
- The row leaves its day. At the end of „Noch ohne Tag“: the folded line W3 „Wartet auf Antwort · 2“ (same component as „Nächste Wochen“, under it). Expanded: `PanelLine`s – title, W4 „bis Mo 7. Dez. · von Vermieter“, end action „Zurückholen“.
- On the day: the thing is an ordinary row in „Noch ohne Tag“ again with chip W5 „Antwort da? · von Vermieter“ before its other chips. The chip is text (not a button); it goes when he gives the thing a day, ticks it, or parks it again.

## States

nothing waits (no line) · n waiting · back today · person deleted (W4 / W5 without „von …“) · source without `onWait` (no entry).

## 1920 / 412

Same. 412: „Zurückholen“ is the line's only action (44 px).

## Edge cases

- A thing that was „fest“: the lock goes with the day (one undo brings both back).
- Parked from a bundle: not offered for members (take it out first).
- Parking twice: the later date replaces the earlier.
- The date passes while the app is closed: nothing was written; the source lists it again at the next reading.

## Tests

- ToDos `onWait` / `listWaiting`: `startDate` round trip; write spy: the return writes nothing.
- Action test: one undo restores day, lock and link.
- e2e seed `e2e/seed/plan-wait.seed.spec.ts` (fixed clock, then the clock moved); `planner-hub-2.spec.ts` D5 re-measured.
