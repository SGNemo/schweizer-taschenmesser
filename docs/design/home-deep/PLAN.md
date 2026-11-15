# Overview polish – plan (round "Tiefe", `fix/home-polish`)

**Ist (2026-11-15, seeded Dev-Preview, 1280/1920/2560/412, light/dark, seeded and empty):** the packed masonry grid
leaves ragged rows (up to 97 px height difference between neighbours, 6–7 ragged rows and 24–25 rows with free width per
page on desktop); the signature mark stands about 60 px left of the content edge because the hidden gear keeps its room;
KPI context lines break inside a part ("verfügbar · / Ausgaben ▲ …"); the notiz paper's rules cross the text (chat, mail);
empty widgets show the fish and read like errors; due lists break a name into one syllable per line on the phone
("Stadt-/werke/Mus-/ter-/stadt"); one place in "Uhrzeit anderswo" fills half of a two-column card; the weather swatch lies
over the card (absolute) and can cover a long context line.

**Ziel:** every row flush (same top and bottom), no dead page area, context lines without ugly breaks, empty states
quiet and small, nothing over a card's edge.

**Package (one, small enough):** grid (`home/Home.module.css`, `home/masonry.ts` → build-up only), widget head
(mark flush right, gear in the mark's place on hover), empty widgets without the fish (`ui/Misc.tsx` attribute +
`Home.module.css`), widget bodies (`ui/widgets`: context parts, notiz rules, due rows wrap, lone tile spans the row),
weather widget row layout (`modules/weather`). Guards: `e2e/seed/home-polish.seed.spec.ts`, U19 in
`ui6-home-settings.seed.spec.ts`, `home/gridSizes.test.ts`, `ui/widgets/bodies.test.tsx`.

**Nach (same tour):** 0 ragged rows, 0 rows with free width at 1280/1920/2560, seeded and empty. Cost: a short card in a
row with a tall one has free room at its bottom (1920 seeded: 1 591 px over 33 cards; largest: an empty "Musik" card,
+199 px). Follow-ups: PR text "Noch offen".
