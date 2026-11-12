# Module identity v3.1 – rules for every module

> **Identity 4.0 (UI audit 2026-11) changes the module head and the navigation around it:** the section [Identity 4.0 – draft](#identity-40--draft) at the end replaces "Frame – who owns what", "Head variants" and the `head` column of the mapping below for the module frame. Palette, signatures, widgets, sidebar and the stripe rule stay as written here.

Binding for every module and for new ones. Origin: [identity-v3/](identity-v3/) (diagnosis, concept, mockups), audit and fix packages: [identity-v3-audit/](identity-v3-audit/01-findings.md) (v3.1 = the foundation fix package; sheets `identity-v3/shots/frame-v31-*.jpg`). Decisions: [ui-shell](../decisions/ui-shell.md) "Module identity v3" and "Identity v3.1". It extends [DESIGN-SPEC](DESIGN-SPEC.md) and [FOCUS-GUIDELINES](FOCUS-GUIDELINES.md).

## Frame – who owns what

`router.tsx` wraps every module page in `layout/AreaFrame`: a full-bleed **head band** (`ui/HeadSurface`), the area's **sub-navigation**, then the `PageContainer` with the module's content.

| Zone | Owner | Content |
| --- | --- | --- |
| Notice (optional) | module via `HeroSlot area="notice"` | one hint that outranks the page |
| Head band, row 1 | shell | eyebrow (icon plate + "Bereich · Modul") left, gear and "Mit KI eintragen" at the band's right edge |
| Head band, content column | shell + module | capped at `--page-content` (70 rem), aligned to the page: the page's **h1**, then one row **figure \| signature slot \| extra** |
| Figure | module via `HeroSlot area="figure"` (else `contributions.headline`) | the headline figure (`HeroFigure`) |
| Signature slot | frame draws `identity.signature`; module may fill it via `HeroSlot area="signature"` | sized by the head variant (S 4 rem · M 36 rem · L full column for the frame's default; a page's own block flows beside the figure and may grow to the column) |
| Extra | module via `HeroSlot` (default area) | strips and controls (hour strip, start/stop) |
| Sub-navigation | shell (`ui/SubNav`) | one pill per module of the area, the active one filled in its hue |
| Toolbar, content | module | `PageHeader` views/children, `Toolbar`, lists, grids |

- **A module never draws its own head or h1.** `PageHeader`/`PageTitle` render the h1 into the head (and hand the title text to the phone's compact bar); without a shell they render in place.
- **Widths** (`manifest.layout`): `narrow` 45 rem, `content` 70 rem, `wide` 100 rem, `full`. The band stays full width; its inner box follows the page container, the content column ends at 70 rem even on a 100 rem page.
- **Nothing runs past the window, nothing is clipped.** Guard: `e2e/seed/layout-overflow.seed.spec.ts` (every module, split routes, overview, library, tools, settings × 6 viewports × light/dark; reports elements beyond the window and `overflow: hidden` without an ellipsis) and `e2e/layout.spec.ts`.
- **Master–detail follows the page** (`useSplitView()`, 56 rem of page container). **Phone:** the row under the title stacks, the signature slot scales to 70 % (`zoom`), never `display: none`; scrolled, the head scrolls away and a one-line bar fades in (`core/shell/heroCollapse.ts`).

## Stripe rule

**No coloured edge stripe, anywhere.** Identity colour sits in exactly these places: the **icon plate**, the **tinted head** (or widget head zone), a **hairline all around or a top edge**, a **background tint** of a whole surface, a **filled chip**. Urgency: badge or figure with words, red only for overdue/exceeded. Guard: `ui/noStripes.test.ts` (coloured `border-left`, thin bar pseudo-elements, one-sided `inset` shadows, hard `linear-gradient(90deg …)` stops; `KNOWN_STRIPES` lists what a module package still owns and only shrinks).

## Head variants (manifest `identity.head`)

Nine silhouettes, two heights from tokens (`--head-h-tall` 12.5 rem / phone 8.5 rem; `--head-h-compact` 6 / 5 rem – the class is the token, content in `extra` does not change it). The head carries the area's pattern at 6 % (dark theme 3 %, UI audit 2026-11 AE2) and a tint of the hue (40 → 12 %). **Text on the band is `--text` or `--text-on-tint`, nothing quieter** (`tokens.test.ts` scans the head-zone files).

| Variant | Height | Slot | Content | Modules |
| --- | --- | --- | --- | --- |
| `kennzahl` | tall | M | the headline figure is the page, context line, cards beside it | Finanzen, Budgets, Listen |
| `zeit` | tall | L | day number + hour strip with the "now" line (`calendarLeaf`, `stopwatch`) | Kalender, Zeiterfassung |
| `fortschritt` | tall | M | title + "n von m"; rings of the module | Gewohnheiten, Abos, Dieser PC |
| `cover` | tall | L | cover with its own tone, title, artist | Musik |
| `himmel` | tall | – | sky backdrop, thin temperature | Wetter |
| `regal` | tall | M | count figure + tiles on a shelf | Karten & Orte, Vorräte, Merkliste, Feeds, Unterlagen |
| `tresor` | compact | S | framed, lock status | Passwörter |
| `schreib` | compact | S | paper: plain surface, serif title, ruled edge; the mark beside the title | Notizen, Browser, E-Mail, Beispiel |
| `fokus` | compact | S | one thing large beside the small module name, the mark next to it | ToDos, Personen, Rechnungen, Chat, Downloads |

`COMPACT_HEADS`/`headHeight()`/`SIGNATURE_SLOTS` in `core/modules/types.ts`. Compact heads put title, figure and mark on one line.

## The manifest field `identity`

```ts
identity: {
  hue: ModuleHue; hue2?: ModuleHue;   // primary / secondary colour (second stop of the head; `data-hue2`)
  widget: WidgetVariant;              // shape of the module's widgets (a WidgetDef may override with `variant`)
  head: HeadVariant;                  // silhouette above
  signature: SignatureId;             // the drawing the module is recognised by (one library for modules and tools)
  type?: 'sans' | 'thin' | 'mono' | 'serif'; shape?: 'soft' | 'round' | 'sharp';
}
```

`widgetType` and `feedback` were dropped in v3.1 (nothing read them). The area's **pattern** comes from `manifest.area`. Rules (`scripts/lib/checkIdentity.ts`, same function in `npm run check:modules` on the source and in `registry.test.ts` on the runtime registry): one hue per area; neighbours in an area never share a head; **app-wide** two modules with one hue never share head *and* widget, and a shared head or widget needs a signature of its own (not `none`, not the same). The palette pins every pair of hues at ≥ 26°, so no angle is computed. `signature: 'none'` next to a `HeroSlot` in the page is a `check:modules` warning.

## Signatures (`@/ui/identity`)

Every id in `SIGNATURES` has a **mark** (`SignatureMark`, 24-grid line drawing in `currentColor`) and, for the ids with a block, a **decoration at M/L** (`Signature id size`): `Receipt`, `Bill`, `FolderTabs`, `Stamp`, `Pinboard`, `NotePaper`, `Bubble`, `AddressBar`, `Shelf`, `AvatarRing`, `Gauges`, `ArrowBand`, `Masthead`, `HourStrip`, `WeekBars`, `Envelope` (fill level); the other ids draw their mark on a plate. Rules: decoration only (`aria-hidden`), no user data of its own (`children` is the one line a module may put on it), drawn from `--module-color` and `--surface` so it works without colour. The frame draws the module's signature in the slot until the page claims it; the calendar's leaf (`DayBlock` + today's `HourStrip`) is the one data-aware default (`layout/signatures.tsx`). Tools use the same list (`ToolIdentity.signature`), the tool stage shows the mark; the module settings head shows the signature at S. Module-local copies (`modules/*/components/*Signature*`) move onto the library in the module packages. Guard: `identity.test.tsx` renders every id.

## Tokens (`ui/tokens.css`)

- **Palette v3:** `--mod-<hue>` for lime … orchid (26° HSL steps) and slate. Each ≥ 3:1 on the surfaces and ≥ 25° from danger, accent, warning and success; `--info` sits next to ocean/sky and only warns; the accent variants (teal, coral, lagoon) share a hue family with a module or a state by geometry – the pairs are pinned in `tokens.test.ts`, a new one fails.
- `--text-on-tint`: the one quiet ink on a tinted head or widget zone (light `--text` 84 % over the surface, dark 94 %; ≥ 4.5:1 on the 40 % tint of every hue). `--text-muted`/`--text-3` never on the band.
- `--font-serif`, `--weight-light`: the type accents; no bare `font-weight` number or font stack outside `tokens.css` (`tokens.test.ts` ratchet, module files listed until their package cleans them).
- `--head-h-tall`/`--head-h-compact` (phone values), `--card-pad` (cards and the widget head zone), `--focus` on the default (orange) accent hue in both themes – it stays orange under the teal/coral/lagoon accents, so a ring never blends into the accent it surrounds –, `--slot-s`/`--slot-m`/`--slot-extra` (slot sizes), `[data-hue2]` → `--module-color-2`.
- `--widget-tint` 14 %, `--pattern-head` 0.06 (dark 0.03), `--pattern-widget` 0.04 (dark 0.02; light lines on a dark tint stand out more, AE2), `--group-tint` 6 % (neutral on `--text-3` in the library).
- **"Ruhig" and "Modulfarben: Aus"** flatten the hues to grey, lower the tints and set `--area-pattern: none` (not painted). Shape and signature stay.

## Widgets

The frame (`home/Home.module.css`, `data-widget`, `data-hue`, `data-area`): a head zone tinted `--widget-tint`, the module icon on a tinted plate, the area's pattern behind the content. The grid gives every size class its height (`align-items: start`, s/m/l minimum heights); cards never stretch to the row. **Only what matters today**; urgency stays in the card, the tint never signals state. Bars and rings fill with `--module-color`; `--accent` stays the primary action. **Widget titles are unique app-wide** (registry test).

| Variant | Shape | Body in `@/ui/widgets` |
| --- | --- | --- |
| `kennzahl` | one big number, context line, sparkline | `KennzahlBody` (first example: Finanzen "Kontostand") |
| `zeitleiste` | timeline with dots | `TimelineWidget` |
| `fortschritt` | rings or bars | `FortschrittBody kind="rings" \| "bars"` |
| `cover` | cover, title, controls | module |
| `himmel` | sky wash from the top | module |
| `kacheln` | 2 × 2 tiles, figure + state line | `KachelnBody` |
| `status` | status plate + one action | `StatusWidget` |
| `notiz` | paper with serif title and the first lines | `NotizBody` |
| `fokus` | the one next thing, primary action | module |
| `faellig` | due list with badges | `DueList` |
| `checkliste` | checkboxes | `ChecklistWidget` |

Default order: saved positions first, then the manifest order (no spreading by shape since v3.1).

## Sidebar, scrollbars, overview head

- **Sidebar** (`layout/Sidebar`; Identity 4.0, package 0b-R): on `--bg` in tone steps, no frame, no wash. Brand row; favourites as a sunken track of icons in their module hue, the current one a raised chip; a folded area is its head row, the open one a raised group; module icons in their hue (a quiet mark of what is what, grey in "Ruhig" / "Modulfarben: Aus"), only the current module also fills its 16 % capsule with it (text `--text`); no tinted chips, no wash; Übersicht, Bibliothek and Einstellungen are current as the same capsule in grey, without accent. Collapsed to a rail where the **area colour** lives (with the bottom navigation). Guard: `e2e/seed/frame.seed.spec.ts`. Low pointer screens (≤ 1100 px high): 36 px rows, 2 px group padding, 36 px favourites, 28 px area heads, so every area and module fits 1920 × 1080 without scrolling (overflow spec).
- **Scrollbars:** thin, transparent until hover/scroll (`core/shell/scrollbars.ts`); the sidebar list uses `ui/OverlayScroll`.
- **Overview head** (`home/OverviewHead`): greeting by the hour, date, weather line, calm tools; "Jetzt wichtig" cards; day cards on a time rail.

## Mapping of every module

| Module | Area | `hue` | `hue2` | `head` | `widget` | Signature |
| --- | --- | --- | --- | --- | --- | --- |
| Kalender `calendar` | plan | sky | ocean | zeit | zeitleiste | `calendarLeaf` |
| ToDos `todos` | plan | moss | lime | fokus | fokus | `todayCard` |
| Planer `planner` | plan | indigo | cobalt | kennzahl | fortschritt | `weekBars` (order 15 between Kalender and ToDos; indigo is 26° from cobalt and violet, confirmed by `check:modules`) |
| Gewohnheiten `habits` | plan | violet | orchid | fortschritt | fortschritt | `ring` |
| Zeiterfassung `timetrack` | plan | teal | ocean | zeit | kennzahl | `stopwatch` (round dial, C25/G12: not the calendar's hour strip) |
| Wetter `weather` | plan | cobalt | sky | himmel | himmel | `sky` |
| Karten & Orte `maps` | plan | ocean | sky | regal | kacheln | `pin` |
| Uhr `clock` | plan | lime | fern | fokus | kacheln | `dial` (order 47 after Wetter; lime shares neither head nor widget with Budgets) |
| Personen `people` | plan | orchid | violet | fokus | faellig | `avatarRing` |
| Finanzen `finance` | money | teal | ocean | kennzahl | kennzahl | `bankCard` |
| Rechnungen `invoices` | money | ocean | sky | fokus | faellig | `bill` |
| Abos `subscriptions` | money | indigo | cobalt | fortschritt | faellig | `cycle` |
| Budgets `budgets` | money | lime | moss | kennzahl | fortschritt | `envelope` |
| Listen `lists` | household | orchid | violet | kennzahl | checkliste | `receipt` |
| Vorräte `pantry` | household | fern | moss | regal | kacheln | `shelf` |
| Merkliste `bookmarks` | knowledge | indigo | cobalt | regal | kacheln | `pinboard` |
| Notizen `notes` | knowledge | violet | indigo | schreib | notiz | `notePaper` |
| Chat `chat` | knowledge | sky | cobalt | fokus | notiz | `bubble` |
| Browser `browser` | knowledge | cobalt | sky | schreib | kacheln | `addressBar` |
| Feeds `feeds` | knowledge | moss | lime | regal | kennzahl | `masthead` |
| E-Mail `mail` | knowledge | teal | ocean | schreib | notiz | `stamp` (page: package 2) |
| Musik `music` | knowledge | orchid | violet | cover | cover | `coverTone` |
| Unterlagen `vault` | vault | indigo | violet | regal | kennzahl | `folderTab` (widget: package 2) |
| Passwörter `accounts` | vault | slate | – | tresor | status | `vaultDoor` |
| Dieser PC `disk` | system | slate | – | fortschritt | fortschritt | `gauges` |
| Downloads `downloads` | system | cobalt | sky | fokus | fortschritt | `arrowProgress` |

Pages keep their content until their module package rebuilds them on the v3.1 grid; until then the page's own blocks sit in the signature slot (slot name only).

## Tools

Tools speak the same language: `ToolManifest.identity` `{ hue, hue2?, signature, type? }`, `category`, `keywords` (`npm run check:tools`; neighbours never share a hue; `signature` from the shared `SIGNATURES`). The toolbox (`layout/tools`): list left, the tool right on a `HeadSurface` in its hue (plate, one line, the mark). Tool ids: `display`, `flow`, `ring`, `calendarLeaf`, `globe`, `dice`, `qrFrame`, `idCard`, `notePaper`, `photoFrame`, `pageStack`, `viewfinder`, `terminal`, `splitPage`, `pattern`; mapping in each `tools/<id>/manifest.ts`. Recipe: [howto/new-tool.md](../howto/new-tool.md); contents built with `tools/kit.tsx`. **A tool is not a module:** it may share a module's signature and hue (Datum ↔ Kalender, Timer ↔ Gewohnheiten, Text ↔ Notizen), because the same page never shows both; `check:tools` lists these overlaps as information, never as a failure (F13).

## Clarifications (audit 2026-11-04, kept as rules)

- **Decoration may repeat content only on the module's own page** (`aria-hidden`); the compact bar, overview head, attention cards, agenda and widget heads never carry it.
- **Hue names are not angles:** pick a hue by its swatch in `tokens.css` (`sky` 228°, `cobalt` 254°, `indigo` 280°, `violet` 306°, `orchid` 332°).
- **Empty states:** the widget keeps the fish; a page passes its grey motif to the shared `EmptyState` (`<EmptyState title="Noch keine Belege" motif={<Receipt />} />`), never a local copy.
- **Open from the audit:** Merkliste and Unterlagen share hue and head (`regal`); allowed by the signatures, the heads still look alike – a head change for one of them is a package 2 decision.

## Checklist for a new or converted module

1. Manifest `identity` complete; `npm run check:modules` (area rules and the app-wide rule).
2. The page uses `PageHeader`/`PageTitle`, no own h1 or head; the toolbar wraps; split from the page width.
3. No coloured edge stripe (`noStripes.test.ts`); accent only as plate, tint, hairline or chip.
4. Signature: the frame draws it; fill the slot with `HeroSlot area="signature"` from a library block only when the page has something to say (a count on the stamp); never bigger than the slot (S 4 rem, M 36 rem).
5. Widget: a body from `@/ui/widgets`, only today, empty state with one next step, one context line per number, a unique title.
6. Seeds and onboarding as before; e2e: `data-hue` on the frame; axe both themes; no overflow or clipping at 412 px; the signature stays on the phone.
7. Focus checklist ([FOCUS-GUIDELINES](FOCUS-GUIDELINES.md)): no streak, no guilt text, no permanent motion, an off switch (the colour modes; "Fokus & Aufmerksamkeit" links to "Modulfarben").

## Settings and libraries

Not module pages, so no band: `pages/settings/PageHead` on `ui/HeadSurface` as a rounded card. **Settings:** the landing page has the "Status" head, each category a compact head in its hue **without area pattern** and never a module's hue + area pair (`categoryLook.ts`, test), a module's settings page the module's identity with its signature at S (kept on the phone, smaller). The category list uses the sidebar's look. **Libraries:** `/library` and `/tools` carry neutral (slate) heads, a toolbar and one neutral-tinted section per area; a module card shows a sketch of `identity.widget` (`WidgetMiniature`). **Cards show the identity colour** on `ui/HuePlate` (`e2e/hue-consistency.spec.ts`). **Connect cards** (`pages/settings/ConnectParts`) say the state first. **Tabs** (settings v3.1, [settings-v3](settings-v3/ROUND-1.md)): compact head, at most one tinted `StatusCard` (state + the one filled action), groups with headings (`SettingsGroup plain`), rows = title + one line + control, long text behind ⓘ.

**Choices:** a checkbox that needs an explanation takes `description` (title in the name, detail as `aria-describedby`); a group of them sits in `ChoiceList` (framed, one hairline between rows) instead of one long sentence per box.

## Identity 4.0 – draft

In force in the code since package 0b-2 (UI audit 2026-11, [PACKAGES](ui-audit-2026-11/PACKAGES.md), rules 2–4); "draft" until the acceptance sweep 0b-8 makes it "valid". Decision: [ui-shell](../decisions/ui-shell.md) "Identity 4.0 head and navigation".

**Frame.** `layout/AreaFrame` wraps every module page in a head and the `PageContainer`:

| Zone | Owner | Content |
| --- | --- | --- |
| Notice (optional) | module via `HeroSlot area="notice"` | one hint that outranks the page |
| Title row | shell + module | icon plate in the hue · eyebrow "area · context" (the module's name once the page's title is another one) · the page's **h1** · **one figure** with its context line (`HeroSlot area="figure"` with a `HeroFigure`, else `contributions.headline`) · desktop only: the page's actions and the gear |
| Module row (phone only) | shell (`ui/SubNav`) | the modules of the area as text pills, one row that scrolls sideways |
| Tabs | module via `PageHeader views` | the views of the page (`Tabs`); the head's lower edge |
| Under the head, in the page | module | what a page still brings with `HeroSlot area="signature"` or `HeroSlot` (strips, controls); the area packages decide what stays |

- **Two head variants** (`identity.head`, `HEAD_VARIANTS`): `standard` and `stage`. The nine silhouettes of v3.1 are gone. `standard`: plain `--bg`, a hairline below, **no tint, no area pattern** (AE2, variant A: a pattern never lies behind running text), **no signature slot** (`SIGNATURE_SLOTS.standard = 'none'`; the module's mark lives on its widget, its empty state and its library card). `stage` (Wetter, Musik): the same title row on a `ui/HeadSurface` with backdrop and pattern, then the stage with figure, signature slot (`L`, the frame draws `identity.signature` until the page fills it) and strips; at most one stage per area.
- **Heights are tokens:** `--head-row` 3.5 rem (phone 2.75 rem), `--head-pad`, tabs and module row 44 px. A standard head is ≤ 120 px on the desktop and ≤ 144 px on the phone, a stage ≤ 320 px; the title row has one height whatever is in it, so nothing below it moves when a figure arrives. Guard: `e2e/seed/head-height.seed.spec.ts` (every module from the manifests, both windows; nothing leaves the head's box, no control in the phone's title row).
- **One h1 style:** `--text-h1` 28/600, 22/600 on the phone; no serif, mono or thin titles. The figure in the row is `--text-2xl` with a context line in `--text-muted`; a money figure takes `sensitive` and hides with "Werte ausblenden" (its placeholder is then the one control in the phone's title row: it shows a value, it adds nothing). The number is never cut: the context line gives way first, then the title.
- **It stays at the top.** Desktop: the whole head is sticky in the content area. Phone: sticky with a negative offset, so the title row and the module row slide away and the tabs stay under the top bar (`--topbar-h`, 0 while the bar is folded). No second "compact bar".
- **Navigation in one level.** Desktop: no row of area modules under the head; the sidebar lists them. Phone: the one module row in the head; bottom bar Übersicht · area 1 · **plus** · area 2 · Mehr (`BOTTOM_AREA_SLOTS` 2).
- **One entry point per screen.** A page declares its action once, as `PageAction` inside `PageHeader` (`short` = the thing it adds, a noun). Desktop: the one filled button in the title row; the top bar's "Neu" (quick capture) is neutral. Phone: no control in the head and no floating button; the plus in the bottom bar is the action – on a module page the page's `PageAction` (text `short`, name "`short` eintragen"), else the module's first `quickAdd` entry (text "Neu", name "Neu: …"), everywhere else the quick capture ("Neu", "Neu eintragen"). The name always contains the visible text (WCAG 2.5.3). The head has no "Mit KI eintragen" button; that stays an explicit entry of the capture sheet and the palette.
- **Rules that changed** (`scripts/lib/checkIdentity.ts`): "neighbours never share a head" and "same hue never head and widget alike" are gone; app-wide two modules with one hue each need a signature of their own, and an area has one hue per module and at most one stage.
- **Links and accent (B7):** a link is `--link` (text ink) with `--link-line` (underline); the accent is for the main action and the one active state (the open tab). A chosen filter (`Segmented`, `Chip`) is a surface and a weight, not the accent.
