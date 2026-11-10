# Identity v3 – round 2: concept and variants (2026-11-03, branch `feat/identity-v3-foundation`)

Decisions from round 1 (maintainer): sidebar **wide, grouped, collapsible**; module head in **two heights chosen by
the variant**, area tabs **out of the head** into a sub-navigation; widget **shape follows the head variant**;
references **Things 3, Apple Weather/Wallet**. Mockups: [`mockups/`](mockups/) (`*.html?v=A|B|C&theme=light|dark&device=desktop|mobile`,
contact sheets `sheet--<v>-desktop-light|dark.png`, `sheet--<v>-phone.png`; render with `node mockups/render.cjs`).
Round 3 implements the chosen variant (**D**, § 8); the rules below become the v3 edition of [MODULE-IDENTITY.md](../MODULE-IDENTITY.md).

## 1. Layout frame

- **One frame, one width per area.** `PageContainer` keeps the variants `content` 70 rem · `wide` 100 rem · `full`, but
  the *area* decides, not the module: Planen, Geld, Wissen and Tresor are `wide`, Haushalt and System `wide` as
  well (Listen/Vorräte use the width with a two-column list), `full` only for pages whose content is a grid that needs
  it (calendar week/month, notes editor, browser). A module may still ask for `content`, then the frame keeps the
  area width and centres a narrower *content column* inside the same gutters, so the head and the sub-navigation
  never jump when the user switches module inside an area.
- **Centred with gutters, never beyond the viewport.** The frame is `max-width: calc(width + 2 × gutter)`,
  `margin-inline: auto`, `padding-inline: var(--page-gutter)` (clamp 1 rem … 2.5 rem), `min-width: 0` on every grid
  child; the root font size stays fluid above 1920 px (the frame grows with it, the air beside it stays proportional).
- **Toolbars wrap.** `Toolbar` and `PageHeader` rows are `flex-wrap: wrap`; a `Segmented` control or chip row is never
  an `overflow-x` scroller on the desktop. On the phone a row may scroll, but only with a fade mask at the right edge
  (`mask-image`), a visible end (last chip half visible) and `scroll-snap`; the hidden-scrollbar + hard cut of today
  goes away.
- **Master–detail from the page container**, not the viewport: `@container page (min-width: 72rem)` (≈ 1150 px of
  page) opens the aside; the calendar time grid, the home columns and the ToDos columns use container queries too.
  One breakpoint table in `ui/tokens.css` as custom properties (`--bp-aside`, `--bp-grid-2/3/4`), documented once.
  *Built differently:* `useSplitView()` follows the measured page container (`ui/pageWidth.ts`) from **56 rem**, not 72 rem, so 1280–1440 px laptops keep the panel; the grids keep their container queries.
- **Overflow test.** `e2e/layout-overflow.spec.ts` (CI): for every module entry page, the overview, library, tools and
  settings, in 1280 · 1536 · 1920 · 2560 · 412 px, asserts `document.scrollWidth === clientWidth`,
  `main.scrollWidth === clientWidth`, and that no element inside `main` ends beyond the window unless it sits in a
  scroller that itself fits and carries the fade mask (`data-scroller`). The round-1 spec stays as manual tooling.

## 2. Stripes go; the accent moves to five places

Rule (MODULE-IDENTITY v3): **no left stripe, no coloured edge for identity.** Identity colour appears only as

1. the **icon plate** (module icon on a 16 % tint of the hue; variant C: solid hue with ink on it),
2. the **tinted head** (gradient of the hue over the surface, text stays `--text`),
3. a **hairline frame or top edge** (variant A only: 1 px frame in a 28 % mix, 2 px top edge on widgets),
4. a **background tint of a whole surface** (widget head zone in B, widget body in C),
5. a **filled chip** (active sub-navigation item, active sidebar capsule, selected chip).

Urgency keeps its own grammar (badge with icon + text, red only for overdue/exceeded), never the stripe. The twelve
stripe rules from the diagnosis are removed; the timeline rail (2 px structural line) and quote bars in readers and
the notes editor stay because they are not identity. Lint: a Stylelint rule forbids `border-left(-width|-color)` and
`border-inline-start` with a `--mod-*`/`--module-color`/`--area-color`/state colour value, and `::before` boxes of
2–4 px width at `left: 0`, outside an allow-list (`timeline`, `quote`).

## 3. Head variants (nine, two heights)

| Variant (manifest `head`) | Height | Silhouette and content | Modules |
| --- | --- | --- | --- |
| `kennzahl` Kennzahl-Hero | hero ≈ 200 px | big figure (3.25 rem, 800) with label and context line; right: 12-month sparkline + up to two mini cards in the hue | Finanzen, Budgets, Rechnungen, Abos |
| `zeit` Zeit-Hero | hero | day number 3.25 rem + month/weekday/KW; right: today's hour strip with blocks and the "now" line | Kalender, Zeiterfassung (clock instead of date) |
| `fortschritt` Fortschritt-Hero | hero | title + "n von m" ; right: rings per item (conic, hue) with labels | Gewohnheiten, Dieser PC (drives), Downloads |
| `cover` Cover-Hero | hero | cover 96 px with its extracted colour as `--mod` for the head only, title, artist, controls | Musik, Nachrichten (future) |
| `himmel` Himmel-Hero | hero | sky backdrop (condition + daytime), thin 3.75 rem temperature, condition line, three chips | Wetter |
| `regal` Regal-Hero | hero | count figure; right: 2 × 2 tiles with counts and a shelf line (bottom edge) | Vorräte, Listen (lists as shelves), Merkliste, Karten & Orte (places) |
| `tresor` Tresor-Kopf | compact 96 px | lock plate 40 px + status + "entsperrt bis", hairline frame, vault pattern | Passwörter, Unterlagen |
| `schreib` Schreib-Kopf | compact | plain surface, serif title, ruled paper edge at the bottom | Notizen, Chat, E-Mail, Browser |
| `fokus` Fokus-Kopf | compact | count box "11 heute" + the one next task large + primary action | ToDos, Personen (next birthday) |

Common to all: eyebrow with the icon plate and "Bereich · Modul", h1 (compact heads may drop the h1 when the figure
is the title: ToDos shows the task, the module name sits in the eyebrow), the gear and "Satz eintragen" on the right
(phone: icons only, first row). Head surface: gradient of the hue (`--tint-0 → --tint-1`, per variant 16/4 % · 28/8 %
· 40/12 %) plus the area's pattern (B/C). The area tabs leave the head: **sub-navigation** row under it (eyebrow
"Planen", one pill per module with icon, active pill filled 14 % in the module hue; wraps on the desktop, scrolls with
fade on the phone). The page's own views (Monat · Woche · Tag) stay in the toolbar below. Phone: hero 150 px, compact
80 px, folds to one line after 96 px as today.

## 4. Palette v3

Ten hues, computed in OKLCH and placed so that the HSL hue of every pair is ≥ 25° apart and ≥ 25° from danger, accent,
warning and success in both themes (`tokens.test.ts` rule, now also between hues); alternating depth (deep L 0.46 /
bright L 0.55 in light, 0.76 / 0.84 in dark) so neighbours on the wheel also differ in lightness. Contrast ≥ 3.9:1 on
`--surface` and `--surface-2`. Text on a tint stays `--text`.

| Hue | HSL ° | light | dark | Modules |
| --- | --- | --- | --- | --- |
| lime | 67 | `#6c7a04` | `#c9d475` | Budgets |
| moss | 92 | `#316801` | `#95c16e` | ToDos |
| fern | 117 | `#388534` | `#9bdf97` | Vorräte |
| teal | 176 | `#01665f` | `#37c9bf` | Finanzen, Zeiterfassung, E-Mail |
| ocean | 201 | `#0178b8` | `#8ad5fe` | Rechnungen, Karten & Orte |
| sky | 226 | `#3650a5` | `#94adfe` | Kalender, Chat |
| cobalt | 251 | `#7160bd` | `#ccc1fe` | Wetter, Browser, Downloads |
| indigo | 276 | `#6f3c91` | `#ca9be9` | Abos, Merkliste, Unterlagen |
| violet | 301 | `#9c509b` | `#f4aff3` | Gewohnheiten, Notizen |
| orchid | 326 | `#8d2f64` | `#e791c2` | Personen, Listen, Musik (cover colour on the page) |
| slate | – | `#55636b` | `#a9b7c0` | Passwörter, Dieser PC |

Per module: `hue` (primary) and `hue2` (secondary, default the next hue on the wheel; used for the second gradient
stop, the second series, the second mini card). Check in `check:modules` (v3): inside one area no two modules share a
hue, and every pair is ≥ 25° apart (true for every area above: Planen 7 modules, Wissen 6); on the overview the
adjacency rule for widgets (§ 5) keeps same-hue widgets from sitting next to each other. Group patterns (optional, B/C
only): Planen horizontal rules, Geld dots, Haushalt grid, Wissen diagonal hatch, Tresor fine rules, System none – at
5–9 % opacity, never behind body text, off in "Ruhig".

## 5. Widget variants

Ten shapes on one grid unit (card 16 px radius, type scale as today), each bound to a head variant; the module hue sits
on **one** element (plate, figure, ring, dot, tile edge), never on text:

| Widget (manifest `widget`) | Shape | Head variant |
| --- | --- | --- |
| `kennzahl` | big figure + context + sparkline | kennzahl |
| `zeitleiste` | time rail with dots, "now" row bold | zeit |
| `fortschritt` | rings row (or bars) + "n von m" | fortschritt |
| `cover` | cover 52 px + title + play/pause/next + progress | cover |
| `himmel` | sky band 70 px behind the head, thin temperature | himmel |
| `kacheln` | 2 × 2 tiles with counts, shelf edge | regal |
| `status` | lock plate + state + one action (never content) | tresor |
| `notiz` | first lines of the scratchpad, serif title | schreib |
| `fokus` | one task large + "Anfangen" + "Später", one context line | fokus |
| `faellig` / `checkliste` | rows with state badges / checkboxes (catalogue types kept) | kennzahl · regal |

**Adjacency rule:** the default layout orders widgets so that no two neighbours (left/right, above/below in the
current column count) share a shape or a hue; `home/layout.ts` gets a `spread()` step that reorders only the default
order (the user's own order wins), with a unit test. The head band of v2 goes; A marks the widget with a 2 px top edge
and the plate, B tints the head zone (gradient to the surface after 58 px), C tints the whole body 9 %.

## 6. Sidebar and scrollbars

- 260 px, grouped: brand (home link), **favourites bar** (up to five icon chips in the module hue, a ring on the
  current), then the areas with small-caps headings, a chevron to fold, module rows with icon (A: grey, hue when active;
  B/C: always in the hue), the active row a **filled capsule** (16 % hue, text `--text`), counts right-aligned
  (open ToDos, due invoices). Footer: Bibliothek, Einstellungen, Einklappen. Collapsed: 64 px rail with the app
  icon tile, the time as one line, grey area icons (hue only on the active one) with tooltips on hover and keyboard
  focus; the favourites column and the hover fly-out were not built (2026-11-10, `decisions/ui-shell.md`).
- The stars go (favourites are edited in Settings → Navigation and by long-press/⋯ on a row); the 3 px edge stripe
  and the group-head stripe go; C tints the group block 6 % in the area hue.
- **Scrollbars everywhere** (`global.css`): `scrollbar-width: thin; scrollbar-color: transparent transparent`, thumb
  appears on hover/scroll (`:hover`, `[data-scrolling]` set by a 600 ms timer), overlay without gutter
  (`scrollbar-gutter: auto`), WebKit fallback `::-webkit-scrollbar { width: 8px }` with a transparent track; every
  scroll area gets fade masks top/bottom (sidebar) or left/right (rows) via `mask-image`. Windows classic bars no longer
  take width from the labels.

## 7. Overview head

Greeting ("Guten Morgen", no name) + date line + weather short info (sky swatch, temperature, condition, next rain);
the tools (Cockpit, Ruhig/Ausführlich, Anpassen as icon button) in one quiet row at the right. **Jetzt wichtig** as
cards: icon plate in the module hue, the number large (danger colour only for overdue/exceeded), one label line;
"Wartet noch · n" as a dashed quiet card at the end of the row that unfolds. **Heute · Morgen · diese Woche** as the
agenda component: three day columns with a time rail, dots in the source module's hue, "now" row bold, links to the
entries. Then the widget grid (adjacency rule). Phone: greeting, tools row, cards 2-up, days stacked.

## 8. The three variants (all within the four answers)

| | A · Linie | B · Fläche | C · Material |
| --- | --- | --- | --- |
| Head tint | 16 → 4 %, 1 px frame, no pattern | 28 → 8 %, area pattern 5 % | 40 → 12 %, full-bleed band, pattern 9 % |
| Widget | white card, 2 px top edge, plate | head zone tinted 14 %, plate | body tinted 9 %, solid plate, pattern |
| Sidebar | grey icons, capsule when active | icons in the hue, favourites bar tinted | + area blocks tinted, top of the sidebar in the active hue |
| Signature size | small (plate, figure) | medium (strip, rings, tiles) | large (band, pattern) |
| Reads as | Things 3 | Apple Weather/Wallet | material surfaces |

**Chosen (maintainer, 2026-11-03): C for head, sidebar and overview, the widgets as in B** – rendered as variant
**D** in the mockups (`?v=D`, `sheet--D-*.png`): full-bleed head band with the area pattern at 9 %, tinted sidebar
groups, solid icon plates in head, sub-navigation and attention cards; widgets keep a white body with the tinted head
zone (14 %, gradient to the surface after 58 px), a tinted plate and the pattern at 5 %. Round 3 implements D.

Recommendation before the choice was **B**. A is the quietest and the closest to the current content style, but on the overview the
widgets again differ only by their edge colour; C identifies every module at a glance even in "Ruhig" (the shape and
pattern stay in grey), but the tinted bodies compete with the content on a 2560 screen. B gives shape *and* colour to
head and widget without tinting body text areas, and degrades to A in "Ruhig".

## 9. Decisions to record (round 3, `docs/decisions/ui-shell.md`)

- Identity v3 supersedes v2's head band on widgets and the sidebar/edge stripes; accent only in the five places of § 2.
- Area tabs are a sub-navigation under the head; the head has two heights by variant.
- One frame width per area; container queries decide master–detail and columns; an overflow E2E guards it.
- Palette v3 (ten hues, 25° rule between hues) replaces the ten v2 hues; names stay for hues that keep their place,
  `plum`/`navy` retire, `lime`/`fern`/`cobalt` arrive; every manifest gets the new `identity` v3 fields.

## 10. Round 3 (implementation, Sonnet) – packages

1. Frame and overflow: `PageContainer` area width, toolbar wrap, container-query breakpoints, scrollbars + masks,
   `e2e/layout-overflow.spec.ts`.
2. Tokens: palette v3, tint/pattern tokens, `tokens.test.ts` 25° rule; `identity` v3 in `core/modules/types.ts`
   (`head`, `widget`, `hue`, `hue2`, `pattern`, `signature`), generator template, `check:modules` checks.
3. `layout/AreaFrame` v3 (nine heads from one component with slots), sub-navigation, stripe removal in base components,
   Stylelint rule.
4. Sidebar v3 (favourites bar, capsule, rail, fly-out), bottom nav tint.
5. Overview head (greeting, cards, agenda component), widget shapes in `@/ui/widgets`, adjacency `spread()`.
6. Every manifest mapped (table in MODULE-IDENTITY v3); module-internal content stays with the module chats.

## 11. Mapping of every module (as built in round 3; the live table is in [MODULE-IDENTITY](../MODULE-IDENTITY.md))

The head variants of seven modules differ from the first draft so that neighbours in one area never share a variant (`npm run check:modules`).

| Module | Area | `hue` | `hue2` | `head` | `widget` | Signature in the head | Pattern |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Kalender `calendar` | plan | sky | ocean | zeit | zeitleiste | day number + hour strip | plan |
| ToDos `todos` | plan | moss | lime | fokus | fokus | count box + next task | plan |
| Gewohnheiten `habits` | plan | violet | orchid | fortschritt | fortschritt | rings | plan |
| Zeiterfassung `timetrack` | plan | teal | ocean | zeit | kennzahl | clock + today's strip | plan |
| Wetter `weather` | plan | cobalt | sky | himmel | himmel | sky backdrop, thin temperature | – (sky) |
| Karten & Orte `maps` | plan | ocean | sky | regal | kacheln | place tiles | plan |
| Personen `people` | plan | orchid | violet | fokus | faellig | next birthday + avatar | plan |
| Finanzen `finance` | money | teal | ocean | kennzahl | kennzahl | balance + sparkline + account cards | money |
| Rechnungen `invoices` | money | ocean | sky | fokus | faellig | open sum + receipt | money |
| Abos `subscriptions` | money | indigo | cobalt | fortschritt | faellig | monthly sum + next debit | money |
| Budgets `budgets` | money | lime | moss | kennzahl | fortschritt | free amount + envelope bars | money |
| Listen `lists` | household | orchid | violet | kennzahl | checkliste | list tiles | household |
| Vorräte `pantry` | household | fern | moss | regal | kacheln | shelf tiles with counts | household |
| Merkliste `bookmarks` | knowledge | indigo | cobalt | regal | kacheln | pinboard tiles | knowledge |
| Notizen `notes` | knowledge | violet | indigo | schreib | notiz | paper edge, serif title | knowledge |
| Chat `chat` | knowledge | sky | cobalt | fokus | notiz | last answer | knowledge |
| Browser `browser` | knowledge | cobalt | sky | schreib | kacheln | address bar / tabs | knowledge |
| E-Mail `mail` | knowledge | teal | ocean | schreib | kennzahl | unread count + stamp | knowledge |
| Musik `music` | knowledge | orchid | violet | cover | cover | cover colour on the page | – (cover) |
| Unterlagen `vault` | vault | indigo | violet | regal | faellig | folder tabs, expiring count | vault |
| Passwörter `accounts` | vault | slate | – | tresor | status | lock status (never content) | vault |
| Dieser PC `disk` | system | slate | – | fortschritt | fortschritt | drive rings | – |
| Downloads `downloads` | system | cobalt | sky | fokus | fortschritt | arrow progress | – |

Adjacency on the overview (default order): Heute (fokus, moss) · Kontostand (kennzahl, teal) · Kalender (zeitleiste, sky)
· Wetter (himmel, cobalt) · Gewohnheiten (fortschritt, violet) · Fällige Rechnungen (faellig, ocean) · Vorräte (kacheln,
fern) · Musik (cover, orchid) · Einkauf (checkliste, orchid – not next to Musik in four columns) · Passwort-Tresor (status,
slate) · Nächste Abbuchungen (faellig, indigo) · Laufwerke (fortschritt, slate).
