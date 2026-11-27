# Handoff 2 – the overview: tone, cap, slots

Concept: [CONCEPT-HOME](../CONCEPT-HOME.md). Mockup: `mockups/p2-overview.html`.

| Part | Do |
| --- | --- |
| Tone | `data-sky-tone` on the overview's grid from `skyToneOf(useSharedSky())`; card surface per [00-common](00-common.md); `--text-3-on-tone`; not on "Jetzt wichtig", agenda, head, weather card; off with "Bilder: Aus", colour mode "Ruhig", "Modulfarben: Aus" |
| Cap | pure `pictureKinds(cards, { columns, view, pictures, off })` in `home/` → per card `scene | sign | none`: reading order, cap 4 (cockpit 2, home view "Ruhig" 0), phone adjacency rule, per-module off; set as `data-picture` on the card wrapper |
| Slots | `Home.module.css`: the card gives `CardPicture` its wide or strip slot (measures in 00-common) without changing the card's height on ≥ 2 columns |
| Tests | table tests of `pictureKinds` (order, cap, adjacency, off, views); contrast of every ink on every tone (the existing tokens test pattern); e2e: "Bilder: Aus" → no `data-sky-tone`, cards as before |

States: every sky tone × light / dark; the tone change (600 ms); edit mode (cards being dragged keep their kind until dropped).

Stimulus: the tone at 12 % makes cards count as coloured above the fold ([A11Y §5](../A11Y.md)) – take the CI job's numbers into `e2e/stimulus-budget.json`, name the hit, label `stimulus-raise` by the maintainer.

Not here: any module's picture (no card shows a scene or a new sign after this package; the cap rule is proven with the test spot).
