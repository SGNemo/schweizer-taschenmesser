# Module identity v3 – rules for every module

Binding for every module and for new ones. Origin: [identity-v3/](identity-v3/) (diagnosis, concept, mockups; variant **D** = C's heads and tokens with B's widgets). Decisions: [ui-shell](../decisions/ui-shell.md) "Module identity v3". It extends [DESIGN-SPEC](DESIGN-SPEC.md) and [FOCUS-GUIDELINES](FOCUS-GUIDELINES.md); history: [identity-v2/](identity-v2/).

## Frame – who owns what

`router.tsx` wraps every module page in `layout/AreaFrame`: a full-bleed **head band**, the area's **sub-navigation**, then the `PageContainer` with the module's content.

| Zone | Owner | Content |
| --- | --- | --- |
| Notice (optional) | module via `HeroSlot area="notice"` | one hint that outranks the page |
| Head band | shell | eyebrow (icon plate + "Bereich · Modul"), the page's **h1**, headline figure or signature, gear and "Mit KI eintragen" |
| Sub-navigation | shell (`ui/SubNav`) | one pill per module of the area, the active one filled in its hue; wraps on the desktop, scrolls with a fade on the phone |
| Toolbar | module | search, filters, period, view switch, "Neu" (`PageHeader` views/children, `Toolbar`); wraps on the desktop |
| Content / aside | module | lists, grids, charts; aside opens from 56 rem of page (below) |

- **A module never draws its own head or h1.** `PageHeader`/`PageTitle` render the h1 into the head; without a shell (dialogs, tests) they render in place.
- **Widths** (`manifest.layout`): `narrow` 45 rem, `content` 70 rem, `wide` 100 rem, `full`. `frameVariant()` lifts `content` to `wide` so head, sub-navigation and page do not jump when switching modules in an area. The frame is centred with `--page-gutter`; the root size stays fluid above 1920 px.
- **Nothing runs past the window.** Grid children have `min-width: 0`; a row that may scroll (phone chips, hour strip) says so with a fade mask. Guard: `e2e/seed/layout-overflow.seed.spec.ts` (every module, overview, library, tools, settings × 6 viewports × light/dark) and `e2e/layout.spec.ts`.
- **Master–detail follows the page, not the window:** `useSplitView()` is true from 56 rem of page container (`SPLIT_PAGE_REM`, `ui/pageWidth.ts`; the sidebar, the rail or a narrow window change it). Outside a container it falls back to the 1200 px window query.
- **Dialogs only for short tasks.** A module is a page, also when it is small. **Phone:** the head is a compact bar (icon-only actions) and scrolls away; the one-line bar fades in (`core/shell/heroCollapse.ts`).

## Stripe rule

**No coloured edge stripe, anywhere.** Identity colour sits in exactly these places: the **icon plate**, the **tinted head** (or widget head zone), a **hairline all around or a top edge**, a **background tint** of a whole surface, a **filled chip** (active pill, sidebar capsule). Urgency has its own grammar: badge or figure with words, red only for overdue/exceeded. Kept because they are structure, not identity: the 2 px timeline rail and quote bars in readers and the notes editor. Guard: `ui/noStripes.test.ts` (coloured `border-left`/`inline-start`, thin bar pseudo-elements; allow-list `timeline`, `quote`).

## Head variants (manifest `identity.head`)

Nine silhouettes, two heights (tall 12.5 rem / phone 8.5 rem; compact 6 / 5 rem). The head carries the area's pattern at 6 % and a tint of the hue (40 → 12 %); text on it is always `--text`.

| Variant | Height | Content | Modules |
| --- | --- | --- | --- |
| `kennzahl` | tall | the headline figure is the page, context line, mini cards | Finanzen, Budgets, Listen, E-Mail |
| `zeit` | tall | day number + hour strip with the "now" line | Kalender, Zeiterfassung |
| `fortschritt` | tall | title + "n von m"; rings of the module | Gewohnheiten, Abos, Dieser PC |
| `cover` | tall | cover with its own tone, title, artist | Musik |
| `himmel` | tall | sky backdrop, thin temperature | Wetter |
| `regal` | tall | count figure + tiles | Karten & Orte, Vorräte, Merkliste, Feeds, Unterlagen |
| `tresor` | compact | framed, lock status, fine vault rules | Passwörter |
| `schreib` | compact | paper: plain surface, serif title, ruled edge | Notizen, Browser, Beispiel |
| `fokus` | compact | one thing large, small module name | ToDos, Personen, Rechnungen, Chat, Downloads |

`COMPACT_HEADS`/`headHeight()` in `core/modules/types.ts`. Neighbours in an area (order, id) never share a head variant (`npm run check:modules`, registry test).

## The manifest field `identity`

```ts
identity: {
  hue: ModuleHue; hue2?: ModuleHue;   // primary / secondary colour (second stop of the head, second card)
  widgetType: WidgetType;             // catalogue base type of the main widget
  widget: WidgetVariant;              // frame shape of the module's widgets (a WidgetDef may override with `variant`)
  head: HeadVariant;                  // silhouette above
  signature: SignatureId;             // the one thing the module is recognised by (grey as empty-state motif)
  type?: 'sans' | 'thin' | 'mono' | 'serif'; shape?: 'soft' | 'round' | 'sharp'; feedback?: 'tick' | 'pulse' | 'ring' | 'none';
}
```

The area's **pattern** is not a field: it comes from `manifest.area` (`data-area` → `--area-pattern`: plan lines, money dots, household grid, knowledge diagonals, vault rules, system none). `npm run check:modules` fails on a missing field, a hue/variant outside the lists, two hues in one area closer than 25° (both themes; slate excluded) and neighbours sharing a head variant.

## Tokens (`ui/tokens.css`)

- **Palette v3:** `--mod-<hue>` for lime, moss, fern, teal, ocean, sky, cobalt, indigo, violet, orchid (26° HSL steps) and slate (neutral for system and vault). Each ≥ 3:1 on the surfaces and ≥ 25° from danger, accent, warning and success (`tokens.test.ts`). Retired: plum, navy.
- `--module-color`, `--module-color-2` come from `data-hue`; `--area-color` from `data-area`.
- `--widget-tint` 14 %, `--pattern-head` 0.06, `--pattern-widget` 0.04, `--group-tint` 6 % (sidebar group blocks), `--pattern-ink`, `--scroll-thumb`.
- **"Ruhig" colour mode and "Modulfarben: Aus"** flatten the hues to grey, widget tint 5 %, group tint 3 %, patterns 0. Shape and signature stay, so a module is still recognisable without colour. No permanent animation; `prefers-reduced-motion` and "less motion" stop everything that moves.

## Widgets

A widget keeps its catalogue base type. The frame (`home/Home.module.css`, `data-widget`, `data-hue`, `data-area`): a head zone tinted `--widget-tint`, the module icon on a tinted plate, the area's pattern behind the content at `--pattern-widget`. **Only what matters today**; urgency stays in the card (badge, figure with words), the tint never signals state.

| Variant | Shape | Frame |
| --- | --- | --- |
| `kennzahl` | one big number, context line, sparkline | head zone + pattern |
| `zeitleiste` | timeline with dots | head zone, no pattern |
| `fortschritt` | rings or bars | head zone + pattern |
| `cover` | cover, title, controls | no head tint, no pattern |
| `himmel` | sky wash from the top | no head tint, no pattern |
| `kacheln` | 2 × 2 tiles with counts | head zone + pattern |
| `status` | status plate + one action | head zone + pattern |
| `notiz` | last note or answer | head zone + pattern |
| `fokus` | the one next thing, primary action | head zone + pattern |
| `faellig` | due list with badges | head zone + pattern |
| `checkliste` | checkboxes | head zone + pattern |

**Adjacency:** in the default order (nothing saved) `spreadVariants()` (`home/layout.ts`) keeps neighbours of different modules from sharing a shape; cards of one module stay together, saved positions and the front widgets never move.

## Sidebar, scrollbars, overview head

- **Sidebar** (`layout/Sidebar`): brand row (logo = home), favourites bar of icon chips, area blocks with small headings and a faint tint, module icons in their hue, the active entry as a tinted capsule; collapsed to a rail of icons with tooltips. The bottom navigation marks the active entry in the area colour.
- **Scrollbars:** thin, transparent until hover/scroll (`core/shell/scrollbars.ts`); the sidebar list uses `ui/OverlayScroll` (overlay thumb, fade masks, drag). One rule for all scroll areas.
- **Overview head** (`home/OverviewHead`): greeting by the hour (h1 "Übersicht: Guten Morgen", no name), date, short weather line (weather module on + place chosen), calm tools (Cockpit, Ruhig/Ausführlich, Anpassen). "Jetzt wichtig" = cards (plate in the module hue, count as figure, "Wartet noch" as a dashed card); "Heute · Morgen · diese Woche" = day cards on a time rail.

## Mapping of every module

| Module | Area | `hue` | `hue2` | `head` | `widget` | Signature |
| --- | --- | --- | --- | --- | --- | --- |
| Kalender `calendar` | plan | sky | ocean | zeit | zeitleiste | `calendarLeaf` |
| ToDos `todos` | plan | moss | lime | fokus | fokus | `todayCard` |
| Gewohnheiten `habits` | plan | violet | orchid | fortschritt | fortschritt | `ring` |
| Zeiterfassung `timetrack` | plan | teal | ocean | zeit | kennzahl | – |
| Wetter `weather` | plan | cobalt | sky | himmel | himmel | `sky` |
| Karten & Orte `maps` | plan | ocean | sky | regal | kacheln | `pin` |
| Personen `people` | plan | orchid | violet | fokus | faellig | `avatarRing` |
| Finanzen `finance` | money | teal | ocean | kennzahl | kennzahl | `bankCard` |
| Rechnungen `invoices` | money | ocean | sky | fokus | faellig | `receipt` |
| Abos `subscriptions` | money | indigo | cobalt | fortschritt | faellig | `cycle` |
| Budgets `budgets` | money | lime | moss | kennzahl | fortschritt | `envelope` |
| Listen `lists` | household | orchid | violet | kennzahl | checkliste | `receipt` |
| Vorräte `pantry` | household | fern | moss | regal | kacheln | `shelf` |
| Merkliste `bookmarks` | knowledge | indigo | cobalt | regal | kacheln | `pinboard` |
| Notizen `notes` | knowledge | violet | indigo | schreib | notiz | `notePaper` |
| Chat `chat` | knowledge | sky | cobalt | fokus | notiz | `bubble` |
| Browser `browser` | knowledge | cobalt | sky | schreib | kacheln | `addressBar` |
| Feeds `feeds` | knowledge | moss | lime | regal | kennzahl | – |
| E-Mail `mail` | knowledge | teal | ocean | kennzahl | kennzahl | `stamp` |
| Musik `music` | knowledge | orchid | violet | cover | cover | `coverTone` |
| Unterlagen `vault` | vault | indigo | violet | regal | faellig | `folderTab` |
| Passwörter `accounts` | vault | slate | – | tresor | status | `vaultDoor` |
| Dieser PC `disk` | system | slate | – | fortschritt | fortschritt | `gauges` |
| Downloads `downloads` | system | cobalt | sky | fokus | fortschritt | `arrowProgress` |

Existing modules got the v3 fields in the manifest only; their pages keep their content until their module chat rebuilds them against the head and widget variant. Signatures without a component render nothing yet (list in `SIGNATURES`; blocks in `@/ui/identity`).

## Tools

Tools are not modules but speak the same language: `ToolManifest.identity` `{ hue, hue2?, signature, type? }`, `category`, `keywords` (checked by `npm run check:tools`; neighbours in the list never share a hue). The toolbox is a large panel (`layout/tools`): list left, the tool right on a surface tinted in its hue (head: plate, one line, signature; no edge stripe). "Ruhig" and "Modulfarben: Aus" flatten it like everywhere else.

| Tool | Category | `hue` / `hue2` | Signature |
| --- | --- | --- | --- |
| Rechner `calc` | rechnen | cobalt / sky | `display` |
| Währung `currency` | rechnen | teal / ocean | `flow` |
| Einheiten `units` | rechnen | lime / moss | `flow` |
| Timer & Stoppuhr `timer` | zeit | violet / orchid | `ring` |
| Datumsrechner `dates` | zeit | sky / ocean | `calendarLeaf` |
| Zeitzonen `timezones` | zeit | ocean / teal | `globe` |
| QR-Code `qr` | erzeugen | indigo / cobalt | `qrFrame` |
| Würfel & Zufall `dice` | erzeugen | orchid / violet | `dice` |
| Anonyme Persona `persona` | erzeugen | violet / indigo | `idCard` |
| Bilder `image` | medien | fern / lime | `photoFrame` |
| PDF `pdf` | medien | indigo / violet | `pageStack` |
| Bildschirmfoto `screenshot` | medien | sky / cobalt | `viewfinder` |
| Text `text` | text | moss / fern | `notePaper` |
| Entwickler `dev` | entwickler | slate | `terminal` (mono) |
| Textvergleich `diff` | entwickler | teal | `splitPage` (mono) |
| Regex `regex` | entwickler | lime | `pattern` (mono) |

Recipe: [howto/new-tool.md](../howto/new-tool.md). The tool contents are rebuilt in packages 2 and 3.

## Checklist for a new or converted module

1. Manifest `identity` complete; hue free in the area (≥ 25° from its neighbours), head variant different from the neighbour module in the area; `npm run check:modules`.
2. The page uses `PageHeader`/`PageTitle`, no own h1 or head; the layout variant fills its width; no dialog for the module itself; the toolbar wraps.
3. No coloured edge stripe (`noStripes.test.ts`); accent only as plate, tint, hairline or chip.
4. Signature: a block from `@/ui/identity` through `HeroSlot` (or none yet); decoration only, numbers stay text, works without colour.
5. Widget: base type and variant, only today, empty state with one next step, one context line per number.
6. Seeds and onboarding as before; e2e: the frame carries `data-hue`; axe in both themes; no horizontal overflow at 412 px.
7. Focus checklist ([FOCUS-GUIDELINES](FOCUS-GUIDELINES.md)): no streak, no guilt text, no permanent motion, an off switch (the colour modes).

## Settings and libraries

Not module pages, so no `AreaFrame` band: they use the local `pages/settings/PageHead` (same ingredients: tinted head in the hue, the area's pattern, icon plate, text `--text`, no stripe) as a rounded card in the page container. **Settings:** the landing page has the "Status" head (six figure tiles), each category its own compact head in its hue (`pages/settings/categoryLook.ts`, display only), a module's settings page the module's identity (`hue`, `hue2`, area pattern, signature in small). The category list uses the sidebar's look: group headings, icon plates, the open page as a tinted capsule, a quiet dot for "differs from the default". Rule for new categories: add the look and a nav group (`categoryLook.test.ts`).

**Libraries:** `/library` and `/tools` use the same local `PageHead` (figures in the head), a toolbar (search, status filter, area select) and one tinted section per area (or tool group). A module card is tinted in the module's `hue` and shows a drawn sketch of `identity.widget` (`pages/library/WidgetMiniature`, decoration only); `/library/<id>` is the module as a small page. The sketch never shows data: a new widget variant needs a shape there (`WidgetMiniature.test.tsx` fails otherwise).
