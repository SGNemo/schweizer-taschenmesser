# Hand-off 06 – places and map of an errand round (struck by principle 1; build only on the maintainer's „ja“)

What is built of the errand round – one row, the list ticked inside the bundle – is in [05-bundle](05-bundle.md) (package 5b). This file keeps the struck part: stops with places and the jump to the map.

Concept: [CONCEPT-INTAKE, idea 6](../CONCEPT-INTAKE.md). Builds on [05-bundle](05-bundle.md) (a bundle of kind `errand`). Mockup: `../mockups/06-errand.html`.

## Closed row

lead: the maps glyph (pin), not a button · title (default „Besorgungen“) · meta E1 „3 Stopps“ / „1 von 3“ · minutes = sum.

## Expanded

```
 1  ○ Paket abholen                                                  ⋯
      Post, Lindenstr.
 2  ○ Altglas wegbringen                                             ⋯
 3  ▾ Drogerie · 3 Dinge                                             ⋯
      Drogerie am Markt
        ○ Spülmittel
        ○ Batterien AA
        ○ Zahnpasta
                       [Auf der Karte ansehen]  [Los]  [⋯]
```

- Stops are numbered (text, `--text-3`, tabular); order = the bundle's order, sortable as in 05.
- A list stop is open by default inside the errand (its lists panel: tick lines, max 8 + „n weitere“); `▾` folds it.
- Place: a second line under the stop's title (`--text-meta`, `--text-3`), on every width – or no second line; set through the line's ⋯ → E2 „Ort …“ → a `Dialog` with his saved places (search field + list, from maps through a lazy `places` reader in maps' `linkTarget` module – names only) and „Kein Ort“. Writes the `place` link.
- E3 „Auf der Karte ansehen“: quiet button in the foot, only with ≥ 1 place and maps on. Opens `/maps?places=<id,id>&from=plan`.
- „Los“: step mode of 05; the eyebrow reads „Besorgungen · Stopp 2 von 3“, the place name stands under the title; a list stop shows its tick lines under the title (the one case where „Los“ shows more than a title: the list **is** the step).

A done stop strikes its title only, never the place line.

## States

no places (no E3) · some places · maps off (no „Ort …“, no E3, places already set are not shown) · place deleted in maps (the stop shows no place) · list emptied elsewhere (the stop is done).

## 1920 / 412

Same on both.

## Tests

- maps `linkTarget.test.ts` (place: alive / gone, own data only, id untrusted); `?places=` allow-list parse (ids, ≤ 20, unknown dropped, zero writes).
- Errand panel component test: states above; ticking a list item inside the errand writes what the list page writes.
- e2e seed `e2e/seed/plan-errand.seed.spec.ts`; `planner-hub-2.spec.ts` C2 re-measured.
