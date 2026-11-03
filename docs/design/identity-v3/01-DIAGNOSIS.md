# Identity v3 – round 1: diagnosis (2026-11-03, branch `feat/identity-v3-foundation`)

Seeded Dev-Preview build (`npm run build:e2e-seed`, seed `medium`, fixed clock 2026-09-29 10:00), captured with the new
`e2e/screenshots/identity-v3.spec.ts`: every module entry page, overview (calm, detailed, rail, "Ruhig" colour mode,
cockpit), library, tools, settings; 1280×720 · 1536×864 (1920 at 125 % Windows scaling) · 1920×1080 · 2560×1440 ·
3440×1440 · 412×915 phone; light and dark; reading aid off and on (75 % coverage). Desktop sizes pose as the Windows app
(disk, mail, browser, downloads on), the phone as the PWA. Beside the full shots: a crop of every module head and every
overview widget (contact sheets `grid-heads--*.png`, `grid-widgets--*.png`) and `measure--<viewport>.json` (document and
`main` horizontal overflow, page container width and variant, elements beyond the window or beyond the page).
Screenshots stay out of the repo (size); the contact sheets were handed over in the chat.

## 1. Layout frame: what the measurements say

The shell is a two-column grid (`layout/AppShell.module.css`: sidebar 248 px from 1200 px, icon rail 76 px below or by
choice; `main` scrolls, the document does not). Inside `main`, `PageContainer` (`layout/PageContainer.module.css`) is the
only width rule: `margin-inline: auto` plus `max-width` per variant (`narrow` 45 rem, `content` 70 rem, `wide` 100 rem,
`full` none), a fluid gutter `--page-gutter: clamp(1rem, 0.5rem + 1.5vw, 2.5rem)`.

The root font size is fluid above 1920 px (`tokens.css` `:root { font-size: clamp(1rem, 1rem + (100vw - 1920px) * 0.0026, 1.25rem) }`:
17.7 px at 2560, 20 px at 3440), so every rem width grows with the screen; measured (`measure--*.json`, light, default
settings):

| Viewport (sidebar) | space for the page | `content` 70 rem | `wide` 100 rem | `full` |
| --- | --- | --- | --- | --- |
| 1280 × 720 (248) | 978 px | fills (978) | fills (978) | fills (978) |
| 1536 × 864 (248) | 1210 px | 1120 px, 45 px air each side | fills (1210) | fills (1210) |
| 1920 × 1080 (248) | 1598 px | 1120 px, **239 px air each side** | fills (1598) | fills (1598) |
| 2560 × 1440 (274) | 2198 px | 1236 px, **481 px air each side** | 1766 px, 216 px air each side | fills |
| 3440 × 1440 (310) | 3030 px | 1400 px, **815 px air each side** | 2000 px, 515 px air each side | fills |
| 412 × 915 (none) | 380 px | fills | fills | fills |

Variants in use today (`manifest.layout`): `full` calendar, notes, browser, mail, disk; `wide` todos, weather, people,
maps, finance, invoices, subscriptions, budgets, bookmarks, music, vault, accounts, library, tools, settings, overview;
`content` habits, timetrack, lists, pantry, chat, downloads (default). Nothing on the desktop is anchored to one edge: a
`content` page is a centred 1120 px island, its `wide` neighbour fills 1600 px, a `full` page fills everything, and the
module tabs in the head jump between these three widths when the user switches module inside an area (Planen:
Kalender `full` → ToDos `wide` → Gewohnheiten `content`). That is the "centred with a big empty space on the left"
finding (Gewohnheiten, Vorräte): correct per the rules, wrong as a system, because the three variants were never meant
to sit next to each other in one area.

**Horizontal overflow.** `measure--*.json`: document and `main` overflow are 0 on every page at 1280, 1536, 1920, 2560,
3440 and 412 px, light and dark, reading aid on and off. No element sticks out of the window except the weather page's
hour strip, which is a horizontal scroller by design. The reported "calendar and ToDos run out of the viewport" was
**not** reproducible with the default settings in any of the six viewports (also not with the icon rail or with
"Textgröße: groß"; narrow windows 1024 × 768 and 1100 × 700 checked as well – see §2 F1). What *does* get cut off, and
most likely is what was seen:

- **Area tabs in the module head**: `Tabs.module.css` is a horizontal scroller with the scrollbar hidden
  (`overflow-x: auto; scrollbar-width: none`). With the head's `extra` column (today card, leaf, bank cards, chips)
  the tab row gets `minmax(0, 1fr)` of the remaining width and clips silently: ToDos at 1280 px shows
  "… Karten & Orte · Pers" (`1280x720--todos.png`), Finanzen and Abos at 1536 px with the two cards likewise.
- **Toolbars that scroll instead of wrapping**: the ToDos view chips (`todos.module.css .viewBar`, `overflow-x: auto`),
  the calendar's segmented view switch (`Patterns.module.css .segment { max-width: 100%; overflow-x: auto }`), the
  Vorräte chips. Below ~ 700 px of page width (phone, a half-screen window on Windows, "Textgröße: xlarge") their right
  end is simply gone; nothing wraps, nothing fades, no arrow.
- **Phone head**: `AreaFrame.module.css` puts eyebrow, tabs and actions on one line (`'eyebrow tabs actions'`,
  tabs `minmax(0, 1fr)`); with "PLANEN" left and "Satz eintragen" + gear right the tab row gets ≈ 100 px and shows
  "Kalender · T" (`412x915--calendar.png`, `--todos.png`, `--finance.png`: "Finanzen · Re"). `measure--412x915.json`
  lists the tab links at x = 458 … 733 px on a 412 px screen. The page's own segment (Übersicht · Buchungen · Konten ·
  Kateg…) clips at the right edge as well. Document overflow is 0 because both rows are scrollers – the user sees a
  cut, not a scrollbar.
- **Rail wordmark**: in the 76 px icon rail the brand (`Wordmark height=28`, aspect 1368 : 401 = 95 px wide) is
  wider than the rail and is clipped at the right (`1280x720--calendar-rail.png`, `Sidebar.tsx` brand).

**Breakpoints disagree.** Master–detail is decided by the viewport (`ui/Patterns.tsx SPLIT_QUERY = (min-width: 1200px)`,
mail the same), the calendar time grid by its own query (`calendar/components/Views.tsx TIME_GRID_QUERY`), the home grid
and ToDos columns by the page container (`@container page`), the shell rail by 1200 px, the phone frame by 900 px. At
1280 px the calendar therefore shows the week as a list *and* the agenda side panel (`1280x720--calendar.png`): the
viewport says "wide", the 978 px page says "narrow". A page-container query for every "from this width" decision
removes that class of defect.

## 2. The maintainer's findings, checked

**F1 – Calendar/ToDos run out of the viewport.** Not reproduced (above). Causes of what is actually clipped: the hidden
tab scroller in `AreaFrame` + `Tabs`, the scroller toolbars, and a `PageHeader` whose views and actions are
`flex-wrap: wrap` but whose *contents* (segment, chip rows) are `nowrap` scrollers. Fix in the frame, not per module:
a head grid that lets the tab row wrap or fold into a menu before it clips, toolbars that wrap (`Toolbar` as the one
wrapping row), scrollers only on the phone and then with a fade and an end affordance.

**F2 – Gewohnheiten and Vorräte centred with empty space left.** Confirmed at ≥ 1536 px. Cause: `PageContainer`
`margin-inline: auto` + `content` 70 rem, while the neighbours in the same area are `wide`/`full`
(`1920x1080--pantry.png`: page starts at x = 524 next to a sidebar that ends at 248). The v2 rule "a page fills its
variant" was applied per module and never checked across an area.

**F3 – Stripes do not fit the design.** Inventory of left stripes and coloured edges (all in base components or home,
not in module content), with the owner:

| Where | Rule | File |
| --- | --- | --- |
| "Jetzt wichtig" chips | `border-left-width: 4px` + tone colour | `home/AttentionStrip.module.css:25-48` |
| Module "now" strips (calendar, finance, pantry) | same chip, 4 px | `core/modules/NowStrip.module.css:16-39` |
| Cockpit figures | 4 px `::before` in the module hue | `home/CockpitStats.module.css:45-51` |
| ToDos focus card in the "Heute" widget | 3 px `border-inline-start` accent | `modules/todos/widgets/NextWidget.module.css` `.card` |
| List rows with urgency | 3 px `::before`, danger/accent | `ui/Patterns.module.css:620-634` |
| Sidebar area heads | 3 px `::before` in the area colour; active module hue as a 3 px inset shadow at the sidebar edge | `layout/Sidebar.module.css:191-198`, `AppShell.module.css` `.sidebar[data-hue]` |
| Phone module head | `border-top: 3px solid var(--module-color)`; folded bar `border-bottom: 3px` | `layout/AreaFrame.module.css` (`@media (max-width: 899px)`) |
| Calendar entries | 4 px module hue; 3 px per kind in the time grid and agenda | `modules/calendar/routes/calendar.module.css:214, 466, 590` |
| Library group headings | 3 px `.libStripe` in the area colour | `pages/Page.module.css:103`, `ModuleLibrary.tsx:129` |
| Module settings head and chips | 4 px module hue | `pages/settings/ModuleSettingsPage.module.css:17, 92` |
| Widget timeline rail | 2 px `border-left` (structural, keep) | `ui/widgets/Widgets.module.css:155` |
| Reader panels, quote blocks | 3 px (structural, keep) | browser/bookmarks reader, notes editor, chat |

Twelve places, three different widths (2/3/4 px), two meanings (module/area identity vs urgency) with the same shape.
v3 removes the identity stripes (first eight rows) and keeps a stripe only where it is a quote or a rail.

**F4 – All module heads have the same build.** Confirmed: `layout/AreaFrame.tsx` renders one template (eyebrow chip +
area, h1, area tabs, figure/extra slot, actions) on one gradient; `identity.head` (`figure | cover | compact`) only
changes the padding (`AreaFrame.module.css` `.frame[data-head='figure'] { padding-block }`), `surface` the background,
`shape` the radius. There is no per-variant height, arrangement, pattern or typography. Of 23 modules, 17 render the
compact/figure default; only weather (sky), finance (cards), calendar (leaf), todos (today card), habits (rings),
pantry (shelf chips) and music (cover) bring something of their own, and they all sit in the same right column. ToDos and
Vorräte are both `moss`; with the same template the hue is the only difference on the Planen tab row → Haushalt switch.

**F5 – Widgets "Heute" and "Offene ToDos" are hard to tell apart.** Confirmed (`grid-widgets--*.png`). Every widget is
`Card` + the same head band (`home/Home.module.css .widget[data-hue] .head`: chip, title, gradient at 65/80 % of the
module tint), and the body comes from eight catalogue types that share one typography (`ui/widgets/Widgets.module.css`).
Two ToDos widgets (`todos-next`, `todos-open`) are the same hue, the same band, the same checklist rows; the signature
exists only in the module head, not in the widget. 28 widgets, 10 hues, 8 types: identity v2 added the band, not shape.

**F6 – Overview head looks old and unstructured.** `home/Home.tsx`: a `PageHeader` with the h1 "Übersicht" and three
loose controls (Cockpit button, Ruhig/Ausführlich segment, Anpassen), then `AttentionStrip` (chips with stripes),
"Wartet noch" as a `<details>` line, then `AgendaBlock` – a bordered box with the heading "Heute · Morgen · diese
Woche" and a two-column text list (`AgendaBlock.module.css`: `when` 7.5 rem + `what`). No greeting, no date, no weather
in the head (weather is a widget, far below in the detailed view). In the calm view at 1920 px the agenda box is the
full 1598 px wide for three lines of text, then one widget on the left half, then "Mehr anzeigen · 27 Karten"
(`1920x1080--dashboard.png`): the first screen is a form, not a day.

**F7 – Sidebar.** `layout/Sidebar.tsx`: wordmark, favourites list with stars, "Bereiche" with collapsible groups, each
group a flat text list, then Bibliothek / Einstellungen / Einklappen. Identity: icon in the area colour, active entry
tinted in the module hue, 3 px stripe on the group head, 3 px inset stripe at the sidebar edge. The nav list scrolls
(`.nav { overflow-y: auto }`) from ~ 900 px of height with 23 modules; nothing styles the scrollbar, so Windows shows
the 17 px classic bar permanently next to the text, and because it takes its width from the 248 px column the labels
truncate: "Gewohnhei…", "Zeiterfassu…", "Karten & O…" (`v3-extra/scrollbars/1920x1080--dashboard.png`, captured with
`SCREENS_SCROLLBARS=1`; headless shots hide scrollbars otherwise). Stars sit at
the right edge of every row (hover-only with a mouse, always on touch), so on a laptop the favourites block repeats
the first three entries of Planen/Geld with a star – a list, not a leiste. The rail shows the clipped wordmark and
area icons without the module hue.

### Further findings

- **Palette v2 is crowded**: 10 hues for 23 modules, every hue used 2–3 times (teal: finance, mail, timetrack; slate:
  accounts, disk, example; navy: browser, subscriptions, downloads; indigo: bookmarks, budgets, weather). Hue angles
  (HSL) of the light set: moss 82°, teal 176°, ocean 190°, slate 202°, sky 212°, navy 228°, indigo 236°, violet 271°,
  orchid 296°, plum 335° – seven of the ten sit between 176° and 236°, with pairs at 8° (indigo/navy), 10° (sky/slate),
  14° (teal/ocean), 16° (sky/navy). In the dark set teal and ocean are 0° apart (176°/177°). The registry only forbids
  the *same* hue inside one area; nothing measures distance, and the overview puts all areas next to each other.
- **Two tab rows**: the head carries the area tabs (Kalender · ToDos · …), the page adds a `Segmented` for its own views
  (Kalender · Erinnerungen; Monat · Woche · Tag …) and the todos chips – three horizontal switch rows in a row on the
  calendar (`1920x1080--calendar.png`).
- **Head actions**: "Satz eintragen" (AI write) and the gear sit in the head on every page; ToDos then shows a lone "⋯"
  row under the head because its `PageTitle` moved into the head and left the menu behind (`1920x1080--todos.png`).
- **Dark mode** keeps all of the above; the head gradient at 40 % → 10 % reads darker than the page on every hue and the
  stripes become brighter than the text (see `dark-readoff/`).
- **Reading aid** on: heads and tab rows get the emphasis too at 75 % coverage (`*-readon/`), the module chip labels
  and the figures do not (correct), the agenda text list becomes two emphasised columns.
- **"Ruhig" colour mode** (`tm-color=calm`): all hues → `--text-3`, tint 12 % → 5 %; the heads become grey slabs of the
  same height and the stripes stay as grey stripes (`*--calendar-calm-colour.png`): shape alone does not identify a
  module today.
- **Phone**: the head keeps the 3 px top stripe and folds to one line after 96 px; the finance head is 357 px tall
  (figure + bank card = 40 % of the screen before any content); widgets stack in one column with the band, "Jetzt
  wichtig" becomes a column of six striped chips; the bottom bar shows five areas without module hue. Document overflow
  0 on every page; the clipped tab rows are the only defect (§1).

## 3. Questions for the maintainer (round 1 stop)

1. **Sidebar: narrow with icons and fly-out groups, or wide with grouped lists?** Recommendation: *wide by default*
   (260 px) with small group headings, module icons in the module hue, the active entry as a tinted capsule, favourites
   as one compact row of icon chips at the top; collapsible to a 64 px rail with tooltips and a hover fly-out of the
   group. Automatic rail below 1200 px as today.
2. **Module head: tall hero or compact with signature?** Recommendation: *two heights, chosen by the variant*: a hero
   (≈ 180–220 px) for Kennzahl/Zeit/Himmel/Cover/Regal heads, a compact bar (≈ 96 px) for Schreib/Tresor/Fokus heads;
   the area tabs move out of the head into a quiet sub-navigation under it, so the head never clips them and the row
   can wrap.
3. **How far may widgets differ from each other?** Recommendation: *shape follows the head variant* (a KPI card, a
   timeline strip, a progress ring card, a cover tile, a sky tile, a shelf grid, a lock status row), all on the same
   grid unit and type scale, with the module hue on one element each (icon chip, figure, ring) and the band removed;
   neighbouring widgets get different variants by default-layout rule.
4. **References?** Recommendation to calibrate against: Things 3 (lists, calm), Apple Weather/Wallet (hero with
   signature), Linear's sidebar (grouped, capsule, thin overlay scrollbar), Spotify (colour from content). Tell me if
   one of these is the wrong direction (e.g. too much iOS, or Linear too dark/dense).
