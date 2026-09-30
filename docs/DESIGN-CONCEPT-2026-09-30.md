# Design concept and logo candidates (Phase 3a, 2026-09-30)

Proposal for Sven's choice. Renderings: [`design-proposals/design-variants.png`](design-proposals/design-variants.png) (finance + mobile dashboard, light/dark, current vs. A/B/C), [`design-proposals/logo-candidates.png`](design-proposals/logo-candidates.png) (16–512 px, light/dark, app-icon tile), [`design-proposals/logo-wordmarks.png`](design-proposals/logo-wordmarks.png). The variant sheets are token overrides (`design-proposals/variant-*.css`, injected with `SCREENS_CSS=… npm run screenshots`), so what they show is exactly what Phase 3b can deliver through `tokens.css` and the `ui/` components.

## 1. Inventory – what is not right yet (screenshots of 14 views, 3 viewports, light + dark)
- **Accent weight.** Every page has two filled orange controls (header button + FAB), the module library adds a full-width gradient "Aktivieren" per card; module tab bars use a third orange (flat `--accent` rectangles). Orange stops meaning "the one primary action".
- **Three segmented controls.** `ui` Segmented (gradient pill, 36 px), calendar/finance/invoices/budgets copies (flat orange, 44 px, `--border` 1.2:1). Same job, three looks.
- **Dashboard rhythm.** "Heute & Morgen" spans the full width at 1280 px and pushes every other widget below the fold; at 1920 px cards in a row are stretched to the tallest one and show large empty areas; widget headers, headline numbers and empty texts differ per module; mobile rows wrap (time · badge · title).
- **Controls.** Notes search is a labelled full-width input without icon or placeholder; shopping/packing inline inputs, todos 22 px checkbox and habit day pills bypass `ui/Fields`; three progress bars (Patterns, setup, vault meter).
- **Depth and surfaces.** Light theme: the page gradient ends in a whitish cloud bottom-right; cards carry border + shadow + inner highlight at once. Dark theme: cards sit almost tone-in-tone on the background (`--surface` vs `--bg-gradient`), borders barely visible.
- **Typography.** Hero numbers (finance 3rem, tools 2.5rem) and six font weights (400/500/550/600/650/700) are ad hoc; amounts in widgets are not tabular.
- **Motion.** Width transitions on progress bars, colour transitions on many controls, the list stagger keeps items invisible up to 150 ms under reduced motion, dialog backdrop blurs the whole viewport.
- **Empty and loading states.** `Skeleton` unused, "…" as loading text, 8 widgets with their own empty sentence, calendar list views without `EmptyState`.
- **Contrast.** `--border-strong` on `--surface-2` 2.7:1 (switch off-track); module controls on `--border` far below 3:1.

## 2. Concept – common to all variants ("less, but better")
1. **One accent, one job.** Filled orange only for the page's primary action and the FAB. Tabs, filters, nav and links use text-accent or a quiet pill. Module library: compact secondary "Aktivieren"/switch instead of a full-width gradient bar.
2. **One Segmented.** Module copies migrate to `ui/Segmented` (44 px on touch, 40 px on desktop, `--surface-2` track, quiet or gradient pill depending on variant). Same for progress bars and inputs (`ui/Fields`, 24 px checkboxes).
3. **Dashboard grid.** Row height follows content (`align-items: start`), "Heute & Morgen" limited to two columns at ≥ 1280 px, uniform widget header (title · count · link icon), `WidgetList` in every widget, `EmptyState` mini variant for empty widgets, `Skeleton` while loading.
4. **Type scale tokens.** `--text-3xl` (hero numbers), `--weight-medium/semibold/bold` (500/600/700; 550/650 disappear), `--font-num` on every amount/date, `--leading-tight`. New `--z-*` scale, `--focus-ring` shadow token, `--space-hair` (2 px), `--icon-sm/md`.
5. **Motion.** Transform/opacity only: progress via `scaleX`, no colour transitions on hover (instant), stagger delay reset under reduced motion, backdrop blur ≤ 2 px or none, no `background-attachment: fixed` on mobile.
6. **Contrast.** `--border-strong` darkened to ≥ 3:1 on `--surface-2` and added to `tokens.test.ts`; switch off-track uses `--text-muted`.
7. **Theme plumbing.** `theme-color` meta follows the in-app theme; manifest `theme_color`/`background_color` and the splash use token values.

## 3. Variants (choose one; mixing is possible, e.g. A's flat surfaces with B's pill)
| | A „Klar“ | B „Tiefe“ | C „Riff“ |
|---|---|---|---|
| Feel | flat, print-like, calm | today's direction, refined | cool, aquatic, two-colour |
| Page background | solid `--bg`, no gradient | softer gradient, ends in pale turquoise | cool off-white with turquoise tint |
| Cards | border only, no shadow, 14 px radius | border + soft spread shadow, 20 px radius | light shadow, 16 px, cool borders |
| Header / nav | solid, no blur; active nav = soft fill | glass kept; active nav = soft gradient + bar | active nav/tab = turquoise (`--accent-2`) |
| Segmented | `--surface-2` track, active = white pill + accent text | glass track, active = gradient pill | surface track, active = turquoise soft pill |
| Primary button / FAB | flat `--accent` | gradient (as today) | gradient, but orange only here |
| Cost | cheapest to render (no blur/gradient) | blur on 2 bars | like today |
| Risk | may feel "less Nemo" than the ocean gradient | least change, least gain | two accents need discipline |

**Recommendation:** **A „Klar“** for "ruhig und simpel", with the ocean kept where it says Nemo (logo, splash, empty states, README) rather than behind every page. If the gradient should stay part of the everyday look, choose **B**.

## 4. Logo candidates (all own drawings, ≤ 4 shapes, stripes as negative space so they work on any background and as monochrome)
| | L1 „Silhouette“ | L2 „Blase“ | L3 „Welle“ |
|---|---|---|---|
| Idea | geometric fish, two straight bands, no eye | round body, one band, dot eye – the most compact mark | rounded body, two curved bands (real clownfish stripes), dot eye |
| 16 px | tail + two bands still visible | strongest at 16 px (three bold shapes) | good; bands merge to one at 16 px, silhouette holds |
| Character | abstract, badge-like | friendly, playful | organic, calm, closest to "clownfish" without a face |
| Trademark distance | high (no face) | medium (eye) | medium (eye), no cartoon features |
| Wordmark fit | fine | fine, needs +12 px gap to the "N" | best balance with the round Nunito letters |

**Recommendation:** **L3 „Welle“** as mark and app icon; **L2** would be the alternative if the favicon at 16 px is the priority. All three replace the current mark's separate fin and white stripes (5 fills) with one fill and a mask, which also gives the monochrome variant for free.

## 5. What Phase 3b does after the choice
Tokens + base components first (`tokens.css`, Button, Card, Patterns/Segmented, Fields, Misc, WidgetList, Dashboard grid), then module controls migrated to them, then the logo: one SVG source in `web/brand/`, `Logo.tsx` and the splash read the same paths (test), `gen-icons` gets embedded fonts, `favicon.ico`, monochrome badge, unique ids; `tauri icon`; orphan rasters removed; before/after screenshots in `docs/screenshots/nemo/`.
