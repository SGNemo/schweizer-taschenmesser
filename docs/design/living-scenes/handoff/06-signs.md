# Handoff 6 and 7 – signs

Page: [modules/signs](../modules/signs.md). Mockup: `mockups/signs.js` (the drawings) and the overview page.

**Package 6 (group A, feeds existing blocks):** Wochenlast (`WeekBars fill`), Budgets (`Envelope fill`), Downloads (`ArrowBand value`). Each: a pure function datum → 0…1 beside the module's logic, `picture: { step: 1 }`, `<CardSign>`. The planner file touched is only the widget of "Wochenlast" – announce it to planner hub 2 on the board and wait for its yes, or leave Wochenlast for package 8.

**Package 7 (group B, new drawings in `ui/scene/signs/`):** Zeiterfassung (dial), Vorräte (shelf), Routinen (house), Einkauf (basket), Personen (ring with candle), Fitness (hill with flags), Kalender (leaf on the widget).

For every sign: the table row is the test; one hue; ≥ 3:1 on every tone (lowest today: Vorräte's fern, [A11Y §3](../A11Y.md)); ≤ 24 elements; the old mark under "Bilder: Aus"; nothing red; nothing that reads as "missing" (an empty board is an outline, not a gap marker).
