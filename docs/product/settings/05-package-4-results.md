# Settings v2 – package 4 (search)

Branch `feat/settings-search`, after #392, #399, #403, #408, #410. Screenshots: [PR #413](https://github.com/SGNemo/schweizer-taschenmesser/pull/413).

| Search for | Before | Now |
|---|---|---|
| "verwalten" / "Netzwerk" (a sub-group) | nothing | the group, opens its first section |
| a setting | "Category › Section" | "Category › Group › Section"; module settings: "… › To-dos › General" |
| "dunkel", "Dichte" … | link only | link plus the switch itself, no navigation |
| "abends", "cache", "glocke", "tastenkürzel", "rückgängig" | partly | found through everyday words (5 languages) |

Not done: current value in the hit, switching fields beyond the five quick switches (needs an allow-list review per field).
Tests: `registry/search.test.ts` (6), `e2e/settings-search.spec.ts` (desktop + Pixel 7). One test changed: `quick.test.ts` now also allows the path of the reading aid under `barrierefreiheit` (it moved in 3b), the id allow-list is unchanged.
