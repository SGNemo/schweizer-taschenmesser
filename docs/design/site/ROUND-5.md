# Round 5 – the website after Identity 4.0: re-measurement, two mockups, plan

Source: [AESTHETICS-ADDENDUM](../ui-audit-2026-11/AESTHETICS-ADDENDUM.md) AE6, findings W1–W6. Base: `develop` 2079bb5 (2026-11-10), site built locally (`NO_RELEASE_FETCH=1 npm run build`), measured in Chromium at 360, 390, 768, 1280 and 1440 px, dark and light (`npm run screenshots` plus a DOM measurement). **Phase 1 only: nothing in `site/src` changed.** Mockups: [round-5-a.html](round-5-a.html) (flat), [round-5-b.html](round-5-b.html) (depth), shared `round-5.css`.

**Dependency:** Identity 4.0 is not in the app yet (0a accepted with a No-Go for 0b-1, see [STATUS](../../STATUS.md)). Layout, navigation and catalogue do not depend on it; the pictures do. The mockups therefore show today's app.

## W1–W6 re-measured

| Id | Today on `develop` | Verdict |
| --- | --- | --- |
| W1 | 27 cards, each with a drawn widget miniature; states: 6 default, **14 optional, 7 preview** (addendum: 13 / 8). The features section is 3 708 px at 1440 and 5 102 px at 390 | confirmed, counts corrected |
| W2 | Hero picture 440 px wide at 1280 and 1440 (1280 px capture, so app text is about 5 px). At 390 the desktop picture is **268 px** (addendum: ≈ 320) with a 60 px phone beside it | confirmed, width corrected |
| W3 | Nine head tiles; "Tresor", "Papier", "Fokus" are 56 px high, the other six 80 px. 4.0 keeps two heads (standard, stage) | confirmed |
| W4 | Under 64 rem: 0 navigation links, no GitHub link. Page height 11 611 (360), 11 442 (390), 10 116 (768), 8 292 (1280), 8 376 px (1440) | confirmed |
| W5 | `site/README.md` "Focus guidelines": no animation, hover changes colour only | confirmed (rule, see question 2) |
| W6 | Logo at y = 15 and y = 153 (1440). Checksums `<details>` 370 px under the download card at 1440, 948 px at 390 (below the head strip). Two left edges: 170 and 352 px at 1440 (`.wrap.narrow` is centred). Sync titles at y = 5 248 / 5 241 / 5 255 (14 px apart; 37 px at 768). H1 and first H2 both end in "an einem Ort" | confirmed |

Found on the way (not in W1–W6, for phase 2): `site/scripts/screenshots.mjs` points at a Chromium path that no longer exists (`chromium-1194`; works with `PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium`) and renders 360/768/1280/1920 instead of 390/1440; `site/README.md` still names five languages, nine head shapes and screenshots (`calendar`, `todos`, `finance`, `vault`, `reminders`) the script no longer shoots.

## What both mockups do

| Id | Solution | Measured in the mockups |
| --- | --- | --- |
| W1 | Four scenes with one large real picture each (Planen, Geld, Wissen und Haushalt, Tresor), text always on the left. Under them the whole catalogue as one compact list: one row per area, module names with their colour dot, bold = on from the start, platform limit in brackets, preview modules in one quiet last row. The list is still drawn from `catalog/modules.json` | 27 sketch cards → 4 pictures + 7 rows; features 2 614 px at 1440, 1 895 px at 390 |
| W2 | One picture, cut by the right and bottom edge of the hero: 960 px wide (75 % of a 1280 px capture, app text ≈ 10.5 px), about 760 px visible at 1440. Under 48 rem the phone picture in a bezel, cut at the bottom | 440 → 960 px |
| W3 | Head strip removed without a replacement. The module colours appear in the pictures and as dots in the list | 9 tiles → 0 |
| W4 | No JavaScript. A: a second row of plain links (anchor bar) that stays on top while scrolling. B: a `<details>` menu in the bar. Recommendation independent of A/B: **the anchor bar**; a `<details>` panel stays open after a tap on a link and then covers the section it jumped to | 5 links incl. GitHub under 64 rem |
| W4 | Page length on a phone | A / B: 5 726 / 5 744 px at 360 (49 %), 5 519 / 5 537 at 390 (48 %); 1440: 5 917 / 5 998 (71 %) |
| W6 | One `.wrap`, narrow text limits its own width instead of centring; logo only in the header; checksums `<details>` directly under the version line; sync nodes share icon, title and text lines, links sit on the icon line; first H2 reworded | one left edge (170 px at 1440) |

How the phone length is reached: no head strip, 4 pictures of 9 rem instead of 27 cards, catalogue as text rows, the second phone picture ("Gemacht für volle Köpfe") only from 64 rem, comparison as stacked pairs instead of a three-column table, install items all closed, block padding 2 rem.

## A or B

| | A – flat | B – depth |
| --- | --- | --- |
| Hero | `--surface` with a hairline, accent word in `--accent` | ocean gradient `--ocean-from → --ocean-to` (135°) in both themes; ink and accent fixed to the dark set inside the hero |
| Pictures | hairline frame, no shadow | hero picture with a deep shadow; scene pictures stand on a plate in the module colour (14 % tint) with `--shadow-1` |
| Movement | none | one: the hero picture rises 20 px and fades in once on load (480 ms, `transform`/`opacity`), none under `prefers-reduced-motion` |
| Navigation < 64 rem | anchor bar | `<details>` menu (shown for comparison) |
| Cost | none | `--ocean-from/to` join the pinned token subset (`tokens.css`, `tokens.test.mjs` keeps checking against the app); `site/README.md` "no animation" becomes "one entrance, reduced motion respected" |

Contrast on the ocean surface (lightest / darkest stop): text `#fff` 6.1 / 13.9, muted `#e6eef0` 5.2 / 11.8, meta `#dbe6e9` 4.8 / 10.9, accent word `#ffc59c` 4.0 / 9.1 (52 px bold, large text), button `#ffb07a` against the surface 3.4 / 7.8, button text 10.5.

**Recommendation: B**, with the anchor bar from A. The flat page is correct but reads like a document; the ocean surface is the one place the brand tokens allow a gradient, and it separates "this is Nemo" from the app pictures below.

## Decided here (does not change the next step)

- Four scenes, not six: Haushalt joins Wissen, System (two Windows-only modules) appears in the list only.
- The planner highlight goes into the "Planen" scene text; no separate block.
- Order of sections stays. New wording (German and English in phase 2, es/fr/pt-BR stay frozen): H2 "Sechs Bereiche. Du schaltest ein, was du brauchst.", scene texts as in the mockups, list legend.
- Site pictures are shot at 1280 × 800 (desktop) and 412 × 915 (phone), not 1920: at the sizes used a 1920 capture is unreadable.

## Pictures

The mockups load local captures from `web/.screens/site-round-5/` (git-ignored: `home`, `calendar`, `finance`, `notes`, `accounts`, each also `-phone`, `-dark`/`-light`; seeded app, scale `medium`, clock 2026-09-29 10:00, vault unlocked with the seed's demo passphrase). Without them the committed pictures show (`site/src/assets/screens`, `docs/assets/screenshots`), and for Notizen and Tresor a labelled slot. Package 1 adds these names to `site/scripts/app-screenshots.mjs`.

Today's app starts its content late (addendum B1), so the scene crops show mostly page heads. 4.0 moves content up; focal points are set per picture in package 3.

Render the sheets from `site/`: `MOCKUPS=round-5-a,round-5-b SHEET_ROW=1 node ../docs/design/site/render.mjs`.

## Phase 2 (after "Plan freigegeben", one PR each)

| # | Package | Notes |
| --- | --- | --- |
| 1 | Pictures from the seeded app (`app:screenshots`, `--readme`) and social preview | **waits for 0b-8** if the pictures are to show 4.0; see question 4 |
| 2 | Hero, header, navigation | checksums into the download block, logo once, anchor bar; B: ocean tokens + entrance; `site/README.md` rule |
| 3 | Features and catalogue | scenes, compact list from `modules.json`; `IdentityMini` and its catalogue test go with the cards and the head strip |
| 4 | Rest (data, comparison, footer) and measurement | one wrap, sync on one line; fix the screenshot script path and widths; before/after at 390 and 1440, Lighthouse light and dark |

Untouched in every package: CSP and `public/_headers`, token check, `gen:modules`, `fetch-release`, legal texts.

## Answers of the maintainer (2026-11-10)

1. Direction **B** (depth), with the anchor bar from A under 64 rem.
2. One movement: **yes** (hero picture, `transform`/`opacity`, none under reduced motion); `site/README.md` changes in package 2.
3. Preview modules: **one quiet row** at the end of the list.
4. Order: **packages 2–4 now** with today's pictures, package 1 after 0b-8.

Phase 2 starts when the maintainer writes "Plan freigegeben".
