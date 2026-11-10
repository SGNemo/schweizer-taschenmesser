# Settings identity v3.1 – package 3 (navigation and search)

Branch `design/settings-nav`, prompt in PACKAGES.md (removed 2026-11-10, in the git history).

## Variants (one point: where the search sits)

| A – search and quick bar in one row | B – search heads the category column |
| --- | --- |
| `shots/mockup-nav-a-{1280,412}-{light,dark}.jpg` | `shots/mockup-nav-b-{1280,412}-{light,dark}.jpg` |

**Recommendation and build: B.** At the app's real content width next to the sidebar, A wraps into two rows again and saves a band only on very wide screens; B saves the band at every desktop width. The search sits next to the list it filters, and its hits open as an overlay over the content instead of pushing the page down.

## Built

- Desktop: the search moves from its own band into the category column (`navCol`: search + `CategoryNav`, sticky as one); hits overlay the content (`resultsOverlay`, 36 rem). Phone unchanged (sticky search above the page).
- Category list: "Einrichtung" shows "n von m" while steps are open, nothing once all is done (no badge to clear).
- Fix from package 1: the Einrichtung tab shows a placeholder while the setup checklist loads (1–2 s on a seeded app) instead of an empty page.
- Not changed: registry order, deep links (`settingsPath`, `#section--field`), `legacyTarget`, the quick bar.

## Shots and checks

Before: `shots2/after-allgemein-1920-light.jpg` (after package 2). After: `shots3/after-{index,einrichtung,allgemein}-{1920,412}-{light,dark}.jpg`. 412 px: 0 overflow. E2E settings (6 specs), comfort, setup, a11y, layout, mobile-layout: 506 passed; setup/settings-search/settings again after the placeholder: 59 passed.
