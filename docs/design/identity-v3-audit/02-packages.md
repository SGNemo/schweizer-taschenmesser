# Identity v3 – audit, phase 2: proposals · phase 4: fix packages

Follows [01-findings.md](01-findings.md) (finding ids F01–F15, G01–G17, T01–T08). Maintainer decisions after phase 1 (2026-11-04): **foundation package first** for the head silhouettes (F01/F02); **Dieser PC as its own small package** (G01); **E-Mail back to `schreib` + stamp** (F04/G13); **one package for the empty states** with an `EmptyState motif` prop and every module ported (F11). After phase 2 (2026-11-04): the v3.1 head grid as mocked (signature slot beside the figure, content column capped at 70 rem, left-aligned), E-Mail paper head plus one "Posteingang" widget, Dieser PC head + widget rings + token palette, and four packages with the foundation first (part B).

## Part A – proposals (phase 2)
Effort: **S** < half a day · **M** one to two days · **L** several days. Risk: **L** local, covered by existing tests · **M** touches a shared piece or several modules · **H** changes a contract or a rule every chat relies on. Mockups: [`mockups/`](mockups/) (`heads--light|dark.jpg`, `mail--light|dark.jpg`, `disk--light|dark.jpg`; `node render.cjs` re-renders).

### A1 – foundation (shell, tokens, contract; one package, affects every module)
| Finding | Proposal | Effort | Risk | Mockup |
| --- | --- | --- | --- | --- |
| F01, F02 | **AreaFrame v3.1:** every head variant gets fixed grid areas and a **signature slot with a size** (`S` 4 rem · `M` 36 rem · `L` full width) anchored beside the figure; the content column is capped at the `content` width (70 rem) and aligned with the page's left gutter, the band still bleeds. `HeroSlot area="signature"` replaces today's `extra` for signatures (`extra` stays for strips and controls). Variant rules in CSS, not only in the doc: `kennzahl` figure + slot M (sparkline/mini cards), `zeit` date + slot L (strip), `fortschritt` figure + slot M (rings), `regal` figure + slot M (tiles/tabs), `cover` slot L, `himmel` backdrop + figure, `tresor` compact + slot S, `schreib` compact paper + slot S, `fokus` compact, one thing + slot S. Phone: the slot sits under the figure at a reduced size, never `display: none`. Guard: the audit spec's head crops at 1920/2560 assert the slot's left edge within 40 rem of the page's left gutter. | L | M (every head re-flows; modules keep their `HeroSlot` fills, the foundation chat re-maps `extra` → `signature` where a signature is meant) | heads |
| F03 | Token **`--text-on-tint`** (muted text on the head tint, ≥ 4.5 : 1 on the 40 % tint in both themes: `color-mix(in srgb, var(--text) 80 %, var(--surface))` light / 82 % dark, verified by `tokens.test.ts`); replace `--text-muted`/`--text-3` inside `HourStrip`, `CalendarLeaf` and the five module signature files; rule in MODULE-IDENTITY: on the band only `--text` and `--text-on-tint`. | S | L | – |
| F04 | **App-wide collision rule** in `checkIdentity.ts`: two modules with the same `hue` must differ in `head` *and* `widget`; two modules with the same `widget` variant must be ≥ 25° apart or differ in `head`. Resolves with the mapping changes of A2/A3 (mail → `schreib`/`notiz`; vault widget → `kennzahl` counts; subscriptions keeps `fortschritt` but its ring is segmented (cycle), habits' is filled). | S (rule) + mapping in the module packages | H (contract) | mail |
| F05 | **Widget bodies by variant through shared blocks** in `@/ui/widgets`: `KennzahlBody` (figure, context, optional sparkline), `KachelnBody` (tiles with count + state line, replaces pantry's local tiles and maps' card), `FortschrittBody` (rings or bars by prop), `NotizBody` (paper with serif title). A widget variant then has a shape on the overview, not only a frame. Modules switch when their package runs. | M | M | mail |
| F06 | Sidebar density: `@media (max-height: 1100px)` rows 36 px, group padding 2 px, favourites bar 36 px; groups keep the tint. Target: all six groups visible at 1920 × 1080 with 24 modules. | S | L | – |
| F07 | Sidebar and library group tint on **neutral** (`--group-tint` of `--text-3`), the area colour only for the bottom navigation and the rail; module hue stays the only colour in a group. | S | L | – |
| F08 | Add `--info` and `--focus` to the 25° test as a warning; light `--focus` moves to the accent hue (as dark already does) so no module hue sits within 25° of the focus ring. | S | L | – |
| F09 | Overview grid `align-items: start`; widget heights by size (`s`/`m`/`l` rows) instead of row stretch. | S | L | – |
| F10 | Registry test: **widget titles unique** across modules; renames in the module packages (habits "Heute" → "Heute geschafft", browser "Lesezeichen" → "Browser-Lesezeichen"). | S | L | – |
| F11 | `EmptyState` gets `motif?: ReactNode` (grey decoration, the fish stays the default); the 13 module-local empties move onto it in the module packages; plan and money modules get a motif each (calendar leaf, today card, bank card, bill, cycle, envelope, pin, sky, hour strip, avatar ring). | S (prop) + M (porting, see A2/A3) | L | – |
| F12 | **Signature library:** lift the module-local blocks into `@/ui/identity` as the slot fills: `Receipt` (slip), `Bill` (new id, invoices), `FolderTabs`, `Stamp`, `Pinboard`, `NotePaper`, `Bubble`, `AddressBar`, `Shelf`, `AvatarRing`, `Gauges`, `ArrowBand`, `Masthead` (new id, feeds), `HourStrip` (new id, timetrack); `SIGNATURES` lists only ids that exist; the module copies go. | L | M | heads |
| F14 | Settings category heads: hue from `categoryLook`, **no area pattern** (settings are not an area); module settings head shows the module's signature at size S instead of the icon tile. | S | L | – |
| G12 | Contract: `signature: 'none'` only where nothing is drawn; timetrack → `hourStrip`, feeds → `masthead`; `check:modules` warns when a page uses `HeroSlot` and the manifest says `none`. | S | L | – |

### A2 – group Planen + Geld
| Finding | Proposal | Effort | Risk |
| --- | --- | --- | --- |
| G04 | Rechnungen `fokus`: the one thing = open sum + context beside the small module name, `Bill` mark (size S) as the signature, "Nächste bezahlen" in the head; the receipt card goes. | M | L |
| G05 | Budgets: `Envelope` cards (fill level) in slot M; the percentage chips stay in the toolbar. | M | L |
| G10 | Gewohnheiten widget: rings (`FortschrittBody` rings) instead of bars; bars stay for budgets and packing lists. | S | L |
| G11 | Karten & Orte: `KachelnBody` tiles with the pin plate in slot M; the card with chips goes. | S | L |
| F10 | Rename habits "Heute" → "Heute geschafft". | S | L |
| F11 | Motifs for calendar, todos, habits (exists), timetrack, weather, maps, people, finance, invoices, subscriptions, budgets on the `motif` prop. | M | L |
| F15 | Weather aside, todos TodayCard, calendar NextEventLine, invoices page: page-container queries instead of window queries. | S | L |
| G16 | `finance.module.css` second card: `--module-color-2` (one token). | S | L |
| F04 | Subscriptions ring segmented (12 segments, `cycle`) so it is not habits' ring. | S | L |

### A3 – group Haushalt / Tresor / Wissen / Medien / Dienste
| Finding | Proposal | Effort | Risk |
| --- | --- | --- | --- |
| G13, F04 | **E-Mail → `schreib` + stamp:** paper head, serif title, the stamp carries the unread count beside the title, envelope at size S; one widget "Posteingang" (`notiz` body: stamp + two subjects, invoices as a context line) replaces the three teal `kennzahl` widgets. | M | L |
| G02 | Signatures stay on the phone at a reduced size (bubble 48 px, paper 56 px, address bar one line, envelope 40 px); no `display: none`. | S | L |
| G03 | Unterlagen: `FolderTabs` (counts per state) in slot M; the privacy sentence under the sub-navigation as a quiet line; vault widget → `kennzahl` counts (resolves the indigo `faellig` collision with Abos). | S | L |
| G06, G07, G08 | Merkliste pinboard, Chat bubbles, Notizen paper at slot size (M/S/S) beside the figure – mostly solved by A1; the modules only move their block into the slot. | S | L |
| G09 | Feeds: `masthead` signature id (A1) and head stays `regal`. | S | L |
| F10 | Rename browser "Lesezeichen" → "Browser-Lesezeichen". | S | L |
| F11 | Port the 13 local empties onto `EmptyState motif`. | M | L |
| F15 | Notes page: page-container query instead of `useMediaQuery(900px)`. | S | L |

### A4 – Dieser PC (+ Downloads)
| Finding | Proposal | Effort | Risk |
| --- | --- | --- | --- |
| G01 | Head `fortschritt`: figure = used space of the system drive, `Gauges` = drive rings in slate (slot M), warning as a badge, mono type; widget rings in `--module-color`; file-kind palette of the treemap on `--mod-*` tokens via `data-hue` (video ocean, image fern, audio violet, archive lime, program orchid, document teal, game indigo), the age scale on `--viz-*`/warning/danger mixes; the hex palette goes. Downloads: `ArrowBand` into slot M (no content change). | M | M (treemap canvas reads computed tokens) |

### A5 – Werkzeuge + Einstellungen + Bibliothek
| Finding | Proposal | Effort | Risk |
| --- | --- | --- | --- |
| G15 | Toolbox scratch link: `data-hue` from the notes manifest, `var(--module-color)` instead of `--mod-violet`. | S | L |
| F13 | Tool/module kinship documented as intended (a tool is not a module; same page never shows both); `check:tools` prints the overlaps as information, no failure. | S | L |
| F14 | See A1 (settings heads without area pattern; signature S in the module settings head). | S | L |

### Not proposed
G17 (phone FAB over the last widget row) is not identity work; noted for the layout owner. T06 (sync spinner under reduced motion) is a one-line `animation: none` for the layout owner.

## Part B – fix packages (phase 4)

Four packages, each one chat and one PR against `develop`. **Package 0 first**; 1, 2 and 3 branch from `develop` after 0 is merged and may run in parallel (they touch different modules; the only shared files are `strings.ts` blocks and `docs/`). Every package: before-screenshots are the sheets in [`shots/`](shots/), the after-states for 0, 2 and 3 are the [`mockups/`](mockups/). The prompts below are complete; paste one per chat.

| # | Package | Branch | Findings (mandatory) | Hotspots to announce | Skills |
| --- | --- | --- | --- | --- | --- |
| 0 | Foundation: head grid v3.1, tokens, contract, shared blocks | `feat/identity-v3-frame` | F01 F02 F03 F04 F05 F06 F07 F08 F09 F10 F11 F12 F14 G12 G15 · council C01 C02 C05 C06 C07(guard) C08 C09 C10 C11 C12 C13 C15 C16 C17 C18 C20 C21 C28 C30 C31 C33 | `ui/tokens.css` (+ test), `core/modules/{types,registry}.ts`, `layout/AreaFrame*`, `home/Home*`, `ui/Misc` (EmptyState), `ui/identity/*`, `scripts/lib/checkIdentity.ts`, every `modules/*/manifest.ts` (ids only) | council · full stop |
| 1 | Planen + Geld on the new frame (started after `feat/plan-core`, #492) | `feat/identity-v3-plan-money-fix` | G04 G05 G10 G11 F04(subs) F10(habits) F11 F15 · council C07(weather) C19 C22 C23 C25 C26 C27 C29 C34(timetrack) | `modules/{calendar,planner,todos,habits,timetrack,weather,maps,people,finance,invoices,subscriptions,budgets}/*`, `strings.ts` blocks of those modules + 4 locales | review loop · full stop |
| 2 | Haushalt / Tresor / Wissen / Medien on the new frame, E-Mail on paper | `feat/identity-v3-household-knowledge-fix` | G13 F04(mail, vault) G02 G03 G06 G07 G08 G09 F10(browser) F11 F15(notes) · council C03 C04 C23 C24 C34(accounts) | `modules/{lists,pantry,vault,accounts,bookmarks,notes,chat,browser,feeds,mail,music}/*`, `strings.ts` blocks + 4 locales | review loop · full stop |
| 3 | Dieser PC + Downloads | `feat/identity-v3-disk` | G01 (+ downloads slot) | `modules/disk/*`, `modules/downloads/*` | review loop · full stop |

Danach: `docs/site-screenshots-v3` (Website Paket 2) und `qa/identity-v3-sweep` (Abnahme, 03-acceptance.md).

### Prompt – package 0: foundation (`feat/identity-v3-frame`)

```
# Aufgabe: Identity v3.1 – Fundament-Fixpaket (Kopf-Raster, Tokens, Contract, gemeinsame Blöcke)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/identity-v3-frame` von frischem `develop`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Die Gesamtabnahme von Identity v3 (docs/design/identity-v3-audit/01-findings.md, Entscheidungen in 02-packages.md) hat ergeben: die neun Kopf-Varianten sind im Rahmen nur ein Name, die Signatur sitzt 1 500 px von der Figur entfernt, gedämpfter Text auf den getönten Köpfen fällt unter AA, Farbton-Kollisionen über Bereiche hinweg werden nicht geprüft, Widgets einer Variante haben keine gemeinsame Form, 16 von 21 Signatur-Ids haben keinen gemeinsamen Baustein. Der Maintainer hat entschieden: Kopf-Raster v3.1 wie in docs/design/identity-v3-audit/mockups/heads--light.jpg (Figur | Signatur-Platz mit Größe | frei | Aktionen; Inhaltsspalte bei 70 rem gedeckelt, linksbündig zur Seite; Band bleibt vollbreit).

## Pflichtliste (Fund-Ids aus 01-findings.md, jede im PR-Text abhaken)
- F01, F02: `layout/AreaFrame` v3.1: feste Grid-Bereiche je Kopf-Variante; neuer `HeroSlot area="signature"` mit Slot-Größe `S` 4 rem · `M` 36 rem · `L` volle Breite (Variante legt die Größe fest: kennzahl M, zeit L, fortschritt M, regal M, cover L, himmel –, tresor S, schreib S, fokus S); Inhaltsspalte `max-width: var(--page-content)` (70 rem), linksbündig zum Seiten-Gutter; `extra` bleibt für Leisten und Bedienelemente. Telefon: der Slot rutscht unter die Figur in verkleinerter Form, nie `display: none`. Bestehende Module: wo heute eine Signatur in `extra` oder `figure` liegt, auf `signature` umhängen (nur der Slot-Name, kein Inhalt ändern); der Kopf von Modulen, deren Chat erst im Paket 1–3 kommt, darf dabei schmaler, aber nicht leerer werden.
- F03: Token `--text-on-tint` (hell: `color-mix(in srgb, var(--text) 80%, var(--surface))`, dunkel 82 %; Regel in `tokens.test.ts`: ≥ 4,5:1 auf der 40-%-Tönung jedes Farbtons in beiden Themes). Einsatz in `ui/identity/HourStrip.module.css`, `CalendarLeaf.module.css` und in den Modul-Dateien `mail/components/Stamp.module.css`, `accounts/components/VaultDoor.module.css`, `pantry/components/ShelfSignature.module.css`, `lists/components/ListSignature.module.css`, `downloads/components/ArrowBand.module.css` statt `--text-muted`/`--text-3`. Regel in MODULE-IDENTITY: auf dem Band nur `--text` und `--text-on-tint`.
- F04: `scripts/lib/checkIdentity.ts`: app-weit gleicher `hue` ⇒ `head` und `widget` müssen sich unterscheiden; gleiche `widget`-Variante ⇒ ≥ 25° Abstand oder anderer `head`. Die drei heutigen Verstöße (finance/mail, bookmarks/vault, timetrack/finance) löst dieses Paket NICHT im Inhalt, sondern nur im Manifest: `mail` → `head: 'schreib'`, `widget: 'notiz'` (Paket 2 baut die Seite), `vault` → `widget: 'kennzahl'` (Paket 2), `timetrack` → `signature: 'hourStrip'` (siehe G12). Prüfer grün.
- F05: `@/ui/widgets`: `KennzahlBody` (Figur, Kontextzeile, optionale Sparkline), `KachelnBody` (Kacheln mit Zahl und Zustandszeile), `FortschrittBody` (Ringe oder Balken per Prop), `NotizBody` (Papier mit Serifen-Titel). Nur Bausteine + Tests + Doku; Module stellen in Paket 1–3 um. Finanzen-Widget als erstes Beispiel auf `KennzahlBody`.
- F06: Sidebar bei `max-height: 1100px`: Zeilen 36 px, Gruppen-Padding 2 px, Favoritenleiste 36 px; Ziel: alle sechs Gruppen mit 24 Modulen bei 1920×1080 ohne Scrollen sichtbar (E2E-Prüfung im Overflow-Seed-Spec).
- F07: Gruppen-Tönung in Sidebar und Bibliothek neutral (`--group-tint` auf `--text-3`), Bereichsfarbe nur in der unteren Navigation und der Rail.
- F08: `--info` und `--focus` in die 25°-Prüfung (Warnung); helles `--focus` auf den Akzent-Farbton wie im Dunkel-Theme.
- F09: Übersichtsraster `align-items: start`, Höhen je Widget-Größe statt Zeilen-Stretch.
- F10: Registry-Test: Widget-Titel app-weit eindeutig; die zwei Umbenennungen (Gewohnheiten „Heute“ → „Heute geschafft“, Browser „Lesezeichen“ → „Browser-Lesezeichen“) in 5 Sprachen gleich mit erledigen (kleine Strings-Änderung, kein Umbau).
- F11: `EmptyState` bekommt `motif?: ReactNode` (graue Dekoration, Fisch bleibt Standard); Doku-Beispiel; Portierung der Module in Paket 1–3.
- F12: Signatur-Bibliothek in `@/ui/identity`: `Receipt` (Bon), `Bill` (neu, Rechnung), `FolderTabs`, `Stamp`, `Pinboard`, `NotePaper`, `Bubble`, `AddressBar`, `Shelf`, `AvatarRing`, `Gauges`, `ArrowBand`, `Masthead` (neu), `HourStrip` (vorhanden); `SIGNATURES` listet nur Ids mit Baustein; die Modul-Kopien bleiben in diesem Paket stehen und fallen in Paket 1–3 weg (dort Pflicht). Jeder Baustein: Dekoration, keine Nutzerdaten, funktioniert ohne Farbe.
- F14: Einstellungs-Köpfe ohne Bereichsmuster; Modul-Einstellungskopf zeigt die Signatur in Größe S statt des Icon-Tiles.
- G12: `timetrack` → `hourStrip`, `feeds` → `masthead`; `check:modules` warnt bei `signature: 'none'` plus `HeroSlot` in der Seite.
- G15: `layout/tools/ToolsPanel`: Schmierzettel-Link mit `data-hue` aus dem Notizen-Manifest und `var(--module-color)` statt `--mod-violet`.
- Council-Funde (01-findings.md „Council additions“): C01 `ui/Patterns.module.css` `.progressBar` und die Ring-Bausteine füllen mit `--module-color` (Akzent bleibt der Primäraktion; `tone` warning/danger nur für Überschreitung) – betrifft alle Balken/Ringe app-weit, Screenshot-Vergleich im PR. C02 `tokens.test.ts`: die 25°-Prüfung für jeden `data-accent`-Block (teal, lagoon, coral) laufen lassen, Varianten verschieben oder Hue-Tabelle anpassen. C05 `router.tsx`: `NoReadAid` um den ganzen `AreaFrame` für `NO_READ_AID_MODULES`. C06 Sidebar: Gruppen-Tönung unter der aktiven Waschung senken oder Labels in getönten Gruppen auf `--text`. C07 `ui/noStripes.test.ts`: auch `box-shadow: inset <n>px 0` / `inset -<n>px 0` und `linear-gradient(90deg, <farbig> 0 <n>px …)` erkennen (der Wetter-Treffer selbst ist Paket 1). C08 `identity.signature` wird vom Rahmen aus einem `Record<SignatureId, Component>` gerendert (das ist der Signatur-Slot); `feedback` streichen oder anschließen; `widgetType` nur behalten, wenn es etwas steuert; den `calendarLeaf`-Sonderfall in `AreaFrame.tsx` entfernen. C09 ein `HeadSurface` in `@/ui` (Muster, Verlauf, Eyebrow, Plättchen) für AreaFrame, Einstellungs-`PageHead` (aus `pages/settings/` herausziehen) und `ToolStage`; Tokens `--head-h-tall`/`--head-h-compact`; `[data-hue2]`-Regel statt Inline-Styles. C10 feste Zeilen je Höhenklasse (kompakt bleibt kompakt, auch mit Inhalt in `extra`). C11 Tokens `--font-serif`, `--weight-light`; Identity-`type`-Akzente darauf umstellen; Test gegen rohe `font-weight`-Zahlen und Font-Stacks außerhalb `tokens.css`. C12 `categoryLook.ts`: Kategorien neutral (slate, kein Bereichsmuster) oder Test, dass kein (hue, area)-Paar einem Modul gleicht. C13 `checkIdentity.ts`: Winkel-Schleife raus (die Palette pinnt ≥ 26°), app-weite Regel rein, Fakten aus der Laufzeit-Registry statt Regex über Manifest-Quelltext. C15 `spreadVariants` streichen oder auf dem berechneten Raster testen (Modul-Läufe zusammenhalten). C16 Kompakt-Leiste liest den Titel aus dem `HeroContext`, nicht aus dem DOM. C17 unter `calm`/`off` `--area-pattern: none` statt nur Opazität 0; `--card-pad`-Token für die Kopfzone. C18 Overflow-Spec: auch `scrollWidth > clientWidth` unter `overflow: hidden` melden (ohne `text-overflow: ellipsis`), je Master-Detail-Modul eine Split-Route. C20 eine Signatur-Bibliothek für Module und Werkzeuge (`TOOL_SIGNATURES` auflösen). C21 ein Mechanismus für die Figur (`HeroSlot`/Registry; `contributions.headline` mit nur einem Nutzer prüfen). C28 Bibliothek-Band in neutralem oder Marken-Ton, nicht in einem Modul-Farbton. C30 Hinweis/Link von „Fokus & Aufmerksamkeit“ auf „Modulfarben“. C31 Telefon: „Satz eintragen“ mit Tooltip/aria-Label und im ⋯-Menü. C33 `tokens.test.ts`: kein Text-Token unter `--text-muted` in `[data-hue] .head`.

## Nicht in diesem Paket
Modul-Inhalte (Köpfe, Widgets, Leerzustände der Module), Dieser PC, E-Mail-Seite. Keine neuen Farbtöne. Nichts an Signing, Secrets, Tresor-Logik, Sync.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:tools`, `check:i18n`, `e2e` grün; `e2e/seed/layout-overflow.seed.spec.ts` und `identity.spec.ts` erweitert: Kopf-Crops bei 1920 und 2560 prüfen, dass der Signatur-Slot innerhalb von 40 rem vom linken Seiten-Gutter beginnt; kein Element verschwindet bei 412 px (`display: none` an Signaturen = Fehler).
- Vorher/Nachher-Raster wie im Audit: `docs/design/identity-v3-audit/tools/` nach `web/` kopieren, `identity-audit.spec.ts` laufen lassen, Sheets in `docs/design/identity-v3/shots/` als `frame-v31-*.jpg` ablegen (Köpfe hell/dunkel 1920, Telefon 412, Widgets 1920).
- MODULE-IDENTITY.md: Abschnitt „Head variants“ und „Widgets“ auf v3.1 bringen (Slot-Größen, Inhaltsspalte, Tokens); DECISIONS (`decisions/ui-shell.md`) eine Bullet; STATUS eine Zeile; `.changes/`-Notiz (DE/EN, Nutzersicht: „Modulköpfe zeigen ihr Kennzeichen neben der Zahl; Text auf farbigen Köpfen besser lesbar“).

## Skills
Nach dem Bau `council` über den Diff (Architect: Token-Disziplin, Contract, keine lokalen Sonderstyles; Guardian: Kontrast beider Themes, Reduced Motion, Ruhig-Modus; Advocate: Erkennbarkeit ohne Lesen mit den neuen Sheets, Telefon). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn die Slot-Größen je Variante anders ausfallen müssen als oben (Frage mit Empfehlung, ≤ 4).
```

### Prompt – package 1: Planen + Geld (`feat/identity-v3-plan-money-fix`)

```
# Aufgabe: Identity v3.1 – Planen + Geld auf dem neuen Rahmen

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/identity-v3-plan-money-fix` von frischem `develop` (erst nachdem `feat/identity-v3-frame` gemergt ist).

## Ausgangslage
Das Fundament-Paket hat den Kopf-Rahmen v3.1 (Signatur-Slot neben der Figur), die Bausteine `@/ui/identity` und `@/ui/widgets`, die `EmptyState`-Prop `motif` und die Regeln geliefert (docs/design/MODULE-IDENTITY.md). Dieses Paket zieht die elf Module von Planen und Geld nach. Befund je Modul: docs/design/identity-v3-audit/01-findings.md, Vorher-Bilder: docs/design/identity-v3-audit/shots/heads-light-1920.jpg, widgets-light-1920.jpg, empty-pages-light-1920.jpg; Zielbild für fokus-Köpfe: mockups/heads--light.jpg (unterer Teil).

## Pflichtliste
- G04 Rechnungen: `fokus` = offene Summe mit Kontext neben dem kleinen Modulnamen, `Bill`-Marke (Slot S), „Nächste bezahlen“ im Kopf; die Quittungskarte entfällt. Manifest `signature: 'bill'`.
- G05 Budgets: `Envelope`-Karten mit Füllstand im Slot M (Baustein aus `@/ui/identity`, wenn nicht vorhanden: dort anlegen, nicht modul-lokal); Prozent-Chips bleiben in der Toolbar.
- G10 Gewohnheiten: Widget auf `FortschrittBody` mit Ringen (nicht Balken); Kopf-Ringe bleiben.
- G11 Karten & Orte: `KachelnBody`-Kacheln je Kategorie mit Pin-Plättchen im Slot M; die Karte mit Chips entfällt.
- F04 Abos: Monatsring segmentiert (12 Segmente, `cycle`), damit er nicht der Gewohnheiten-Ring ist.
- F11 Leerzustände auf `EmptyState motif`: Kalender (Kalenderblatt), ToDos (Tageskarte), Zeiterfassung (Stundenleiste), Wetter (Himmel), Karten (Pin), Personen (Avatar-Ring), Finanzen (Bankkarte), Rechnungen (Bill), Abos (Ring), Budgets (Umschlag); Gewohnheiten portiert seinen vorhandenen Ring.
- F15 Fenster-Queries raus: Wetter-Aside (`weather.module.css` 1200 px), ToDos `TodayCard` (700 px), Kalender `NextEventLine` (700 px), Rechnungen-Seite (899 px) → `useSplitView()` / `usePageWidthAtLeast()` bzw. `@container page`.
- Alle Signaturen der Gruppe in den Slot (`HeroSlot area="signature"`), modul-lokale Kopien von Bausteinen entfernen (todayCard, avatarRing, calendarLeaf-Kopien, receipt).
- Council-Funde: C07 Wetter-Bewertungszeilen ohne Streifen (`box-shadow: inset 3px 0 0` raus; Chip oder getönte Zeile). C19 Kalender-Zeitraster per `@container page` statt `TIME_GRID_QUERY` 1400 px/700 px. C22 ToDos-Kopf am Telefon: Aufgabentitel einzeilig (gekürzt) und „Später“ bleiben, Button-Name „Anfangen: <Titel>“, Container-Query statt Fenster. C23 Leerzustände der Seiten: ein Verb (die Primäraktion der Toolbar); „Importieren“ und „Einrichtung öffnen“ ins ⋯-Menü. C25 Zeiterfassung: eigene Leistenform (laufender Balken oder Stoppuhr-Bogen) statt der Kalender-Stundenleiste. C26 Wetter ohne Ort: Himmel auch im Ohne-Ort-Zustand, „Ort wählen“ im Körper. C27 Rechnungen-Widget: Fälligkeitsdatum oder „wartet noch“ statt „seit n Tagen“. C29 ToDos/Zeiterfassung: nur eine gefüllte Primäraktion je Ansicht (Formular-Button sekundär). C34 Zeiterfassung-Widget-Leerzustand auf den Fisch/`EmptyState`.

## Nicht in diesem Paket
Rahmen, Tokens, Contract (Fundament); andere Gruppen; keine neuen Farbtöne; keine Datenänderung.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; keine Signatur `display: none` bei 412 px; Kopf-Crops 1920 und 412 hell/dunkel als `docs/design/identity-v3/shots/p1-fix-*.jpg` (Tour aus docs/design/identity-v3-audit/tools/).
- Blindtest-Stichprobe der elf Köpfe und Widgets (Titel geschwärzt, Skript im Audit-Ordner): jedes Modul an Form oder Signatur erkennbar, nicht nur an Farbe oder Text – Ergebnis im PR-Text.
- STATUS eine Zeile, `.changes/`-Notiz (DE/EN), Zeile in CHATS.md.

## Skills
`review loop` (ein Reviewer, Fokus: Form statt Farbe, Fokus-Richtlinien, keine lokalen Styles), dann `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 2: Haushalt / Tresor / Wissen / Medien (`feat/identity-v3-household-knowledge-fix`)

```
# Aufgabe: Identity v3.1 – Haushalt, Tresor, Wissen, Medien auf dem neuen Rahmen; E-Mail auf Papier

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/identity-v3-household-knowledge-fix` von frischem `develop` (nach dem Merge von `feat/identity-v3-frame`).

## Ausgangslage
Wie Paket 1, für die elf Module Listen, Vorräte, Unterlagen, Passwörter, Merkliste, Notizen, Chat, Browser, Feeds, E-Mail, Musik. Befunde: docs/design/identity-v3-audit/01-findings.md; Vorher: shots/heads-light-1920.jpg, heads-light-412.jpg, widgets-light-1920.jpg; Zielbilder: mockups/heads--light.jpg (Unterlagen oben), mockups/mail--light.jpg (E-Mail).

## Pflichtliste
- G13 / F04 E-Mail: Kopf `schreib` (Papier, Serifen-Titel), Briefmarke mit der Zahl der ungelesenen Threads neben dem Titel (`Stamp`), Umschlag in Slot S; EIN Widget „Posteingang“ auf `NotizBody` (Marke mit Zahl, zwei Betreffzeilen, Rechnungsmails als Kontextzeile mit Aktion) ersetzt `mail:unread`, `mail:invoices`, `mail:top`. Keine Mailinhalte außer Betreff und Absendername im Widget (wie heute in `mail:top`).
- G03 Unterlagen: `FolderTabs` (Zahlen je Zustand) im Slot M; der Datenschutz-Satz als ruhige Zeile unter der Unternavigation; Widget auf `KennzahlBody` mit Zahlen (Manifest `widget: 'kennzahl'` kommt aus dem Fundament). Inhalte bleiben Zahlen; `vault.widget.test.tsx` bleibt grün.
- G02 Signaturen bleiben am Telefon: Chat-Blasen 48 px, Notiz-Papier 56 px, Adresszeile eine Zeile, Umschlag 40 px, Pinnwand eine Karte – kein `display: none`.
- G06 Merkliste: Pinnwand (drei Karten, 120 px) im Slot M. G07 Chat: Blasenpaar 88 px im Slot S. G08 Notizen: Papier 160 px im Slot S. G09 Feeds: `signature: 'masthead'` (Baustein aus dem Fundament), Kopf bleibt `regal`.
- Listen/Vorräte: Bon und Regal in den Slot, Kacheln des Vorräte-Widgets auf `KachelnBody`; Passwörter: Tür in Slot S.
- F10 Browser-Widget „Lesezeichen“ → „Browser-Lesezeichen“ (falls im Fundament noch offen).
- F11 Die zwölf modul-lokalen Leerzustände (`*Empty.tsx`) auf `EmptyState motif` portieren, Kopien löschen.
- F15 Notizen-Seite: `useMediaQuery('(min-width: 900px)')` → Seiten-Container.
- Modul-lokale Kopien der Signatur-Bausteine (Bon, Ordnerreiter dreimal, Stempel, Umschlag, Pinnwand, Papier, Blase, Adresszeile, Regal, Tür) durch die Bausteine aus `@/ui/identity` ersetzen.
- Council-Funde: C03 Musik: Cover-Ton unter „Ruhig“ und „Modulfarben: Aus“ ausblenden (wie BankCard/Sky), Tönung je Theme neu rechnen; Player-Bedienelemente am Telefon aus dem Kopf (C10). C04 Unterlagen: Kalender-Beiträge (`vault/calendar.ts`) ohne Dokumenttitel in der Übersichts-Agenda (Kategorie/Anzahl, wie die Aufmerksamkeitskarte) – Standard ohne Titel; ein Opt-in „Titel auf der Übersicht zeigen“ nur, wenn der Maintainer es will (Frage mit Empfehlung „nein“). C23 Leerzustände der Seiten: ein Verb, Import/Einrichtung ins ⋯-Menü. C24 Aufmerksamkeitskarten: abgelaufene Vorräte und abgelaufene Unterlagen mit `warning` statt `danger` (rot nur für Geld und Budgets, FOCUS-GUIDELINES). C34 Passwörter-Widget-Leerzustand auf `EmptyState` (Fisch oder `motif`).

## Nicht in diesem Paket
Rahmen, Tokens, Contract; Planen/Geld; Dieser PC; Tresor-Krypto, Mail-Zugangsdaten, Sync.

## Abnahme
Wie Paket 1 (Checks, keine Signatur versteckt, Kopf-Crops `docs/design/identity-v3/shots/p2-fix-*.jpg`, Blindtest-Stichprobe im PR-Text, STATUS, `.changes/`, CHATS.md). Zusätzlich `exclusion.test.ts` und `vault.widget.test.tsx` unverändert grün.

## Skills
`review loop`, dann `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 3: Dieser PC + Downloads (`feat/identity-v3-disk`)

```
# Aufgabe: Identity v3.1 – Dieser PC bekommt seine Identität; Downloads in den Slot

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/identity-v3-disk` von frischem `develop` (nach dem Merge von `feat/identity-v3-frame`).

## Ausgangslage
Dieser PC war in keinem der vier Identity-Chats: leerer Slate-Hero, kein `HeroSlot`, Widget-Ringe in Akzent-Orange, eigene Hex-Palette (`modules/disk/components/Palette.module.css`). Befund G01 in docs/design/identity-v3-audit/01-findings.md, Vorher: shots/page-1920x1080--disk.jpg, Zielbild: mockups/disk--light.jpg (vom Maintainer freigegeben: Kopf, Widget-Ringe und Token-Palette).

## Pflichtliste
- G01 Kopf `fortschritt`: Figur = belegter Platz des Systemlaufwerks (Mono-Typografie bleibt), Kontextzeile mit freiem Platz, Zustand als Wort/Badge (`fast voll` = warning, nie Ringfarbe), „zuletzt gescannt“; Signatur `Gauges` (Laufwerks-Ringe in Slate, Baustein aus `@/ui/identity`) im Slot M.
- G01 Widgets `disk:status` und `disk:system`: Ringe in `--module-color` (`FortschrittBody` Ringe), Zustand als Badge/Text.
- G01 Dateityp-Palette der Baumkarte auf Tokens: `--k-*` → `--mod-*` über eine Zuordnung (Video ocean, Bild fern, Audio violet, Archiv lime, Programm orchid, Dokument teal, Spiel indigo, Sonstiges slate), Altersskala auf `--viz-*`/warning/danger-Mischungen; die Baumkarte liest die berechneten Tokens wie heute die Hex-Variablen (`Legend.tsx`, `TreemapView.tsx`); Hex-Werte raus; Legende weiterhin mit Text je Farbe.
- Downloads: `ArrowBand` in den Slot M (kein Inhaltswechsel).
- Rust/`guard.rs`, Lösch-Logik, Capabilities: nicht anfassen.

## Nicht in diesem Paket
Alles außer `modules/disk/*` und `modules/downloads/*`; keine neuen Farbtöne.

## Abnahme
`npm run check`, `test`, `check:modules`, `e2e` (Disk-Specs mit Mock-Daten) grün; Kopf- und Widget-Crops hell/dunkel 1920 als `docs/design/identity-v3/shots/p3-fix-*.jpg`; Kontrast der Baumkarten-Farben gegen `--surface` ≥ 3:1 beide Themes (Test); STATUS eine Zeile, `.changes/`-Notiz (DE/EN), CHATS.md.

## Skills
`review loop`, dann `full stop`: PR gegen develop, kein Merge.
```

## Part C – council (one round, three delegates on `develop` 73da10c4)

Scores for the **whole identity v3 implementation on develop**, not for this branch. No fixes were made for the council (this PR carries one allowed one-token fix, G16); every accepted finding is a package item above, so a second round would have re-reviewed the same code. Delegate reports (verbatim): `../../../scribble/` is not used for them; the ledger below is the record.

| Delegate (lens) | Round 1 |
| --- | --- |
| Architect (Claude Opus) | 6/10 · CHANGES |
| Guardian (Claude Opus) | 7/10 · CHANGES |
| Advocate (Claude Opus) | 6/10 · CHANGES |

Open after the round: everything below marked "package" (no fix in this PR by design). Declined as out of scope: Guardian F13 (strength-meter transition, pre-existing in accounts), Advocate F6 (method note, acted on: calm sheets added, cold re-run in the packages' acceptance).

### Ledger
| Delegate · id | Severity | Claim (short) | Outcome |
| --- | --- | --- | --- |
| Architect A1 | should | weather rows draw a left rail with `box-shadow: inset 3px 0 0`; noStripes cannot see it | **confirmed** (code) → C07: guard in package 0, weather row in package 1; T02 amended |
| Architect A2 | should | `widgetType`/`feedback` render nothing; `signature` only special-cased for `calendarLeaf` | **confirmed** → C08, package 0 |
| Architect A3 | should | three head implementations, literal heights, inline hue2 | **confirmed** → C09, package 0 |
| Architect A4 | should | compact is only a min-height; music head 60 % of the phone | **confirmed** (heads-light-1920/-412) → C10, packages 0 + 2 |
| Architect A5 | should | raw font-weight 300, Georgia stack ×12, no tokens | **confirmed** → C11, package 0 |
| Architect A6 | should | settings categories equal module identities | **confirmed** → C12 (F14 raised to S2), package 0 |
| Architect A7 | nit | in-area 25° loop cannot fire; regex parsing brittle | **confirmed** → C13, package 0; palette verdict reworded |
| Architect A8 | nit | hue names drift from angles | **confirmed** → C14, MODULE-IDENTITY clarification (this PR) |
| Architect A9 | nit | spreadVariants weak on the dense grid, splits module runs | **confirmed** (home/layout.ts) → C15, package 0 |
| Architect A10 | nit | compact bar reads the DOM during render | **confirmed** → C16, package 0 |
| Architect A11 | nit | dead comment/no-op reduced-motion rule | **confirmed** → with C10/F02 in package 0 |
| Architect A12 | nit | calm leaves 26 pattern layers; hard-coded `--space-5` | **confirmed** (perf sample "pattern 26" in calm) → C17, package 0 |
| Architect A13 | nit | overflow method blind to clipped content and split routes | **confirmed** → C18, package 0 (tooling) |
| Architect A14 | nit | calendar grid by window 1400 px | **confirmed** → C19, package 1 |
| Architect A15 | blocker | disk has no identity | confirms G01 → package 3 |
| Architect A16–A19 | should/nit | confirm F01, F02, F05, F12, F13; tool/module signature vocabularies collide | → C20, C21 package 0 |
| Architect A20 | nit | `--mod-violet`/`--mod-ocean` hardcodes; the branch carries a code commit | G15 package 0; G16 fixed here (one token, allowed by the task's phase 3) |
| Architect A21 | nit | perf sample confirmed; WebView2/Android unmeasured | agreed; hand test noted in 01-findings |
| Guardian F1 | blocker | `--text-3` on the 40 % tint 2.65–3.16 light / 1.93–2.40 dark (hour labels) | **confirmed** (contrast.mjs now prints t3@40) → F03 corrected, package 0 |
| Guardian F2 | should | AvatarRing `.sub` muted on the tint | **confirmed** → F03 list |
| Guardian F3 | should | music cover tone ignores calm/off; stale tint after theme switch | **confirmed** (no `data-color` guard in MusicHero) → C03, package 2 |
| Guardian F4 | should | accent variants outside the 25° rule | **confirmed** (tokens.test checks the default accent only) → C02, package 0 |
| Guardian F5 | should | document titles reach the overview agenda | **confirmed** (`vault/calendar.ts` uses `d.title`) → C04, package 2 with a maintainer question (default: no title) |
| Guardian F6 | should | NoReadAid does not cover the frame on vault pages | **confirmed** (router.tsx:106-109) → C05, package 0 |
| Guardian F7 | should | no calm sheets; six kennzahl widgets in calm differ by a grey icon only | **acted on**: `shots/heads-calm-1920.jpg`, `widgets-calm-1920.jpg` added; the kennzahl finding stands (F05) |
| Guardian F8 | should | sidebar stacked tints 4.41 : 1 | **confirmed by computation** → C06, package 0 |
| Guardian F9 | nit | ArrowBand, VaultDoor, ListSignature muted on the tint | confirms F03 |
| Guardian F10 | nit | Stamp, Shelf, CalendarLeaf sit on their own surface card | **agreed, F03 corrected** |
| Guardian F11 | nit | `--info` missing in both themes; `--focus` needs no hue rule | **agreed, F08 corrected** |
| Guardian F12 | nit | spinner stops via the global rule; no Sky drift | **agreed, T06 corrected** |
| Guardian F13 | nit | strength meter `transition: width` | declined: pre-existing, outside identity |
| Guardian F14 | nit | bars/rings in accent | → C01 (with Advocate F1), package 0 |
| Guardian F15 | nit | decoration repeats content on the module page: write the boundary | **done**: MODULE-IDENTITY clarification → C32 |
| Guardian F16 | nit | `--text-3` on the widget head zone borderline | → C33, package 0 |
| Guardian F17, F18 | nit | screenshots seed-only; widget/plate contrast passes | confirm T04/T07 |
| Advocate F1 | should | `.progressBar` fills with `--accent` app-wide | **confirmed** (Patterns.module.css:334) → C01, package 0; rule in MODULE-IDENTITY |
| Advocate F2 | should | phone ToDos head drops the title; button name "Anfangen" | **confirmed** (heads-light-412) → C22, package 1 |
| Advocate F3 | should | empty pages offer three actions | **confirmed** (empty-pages sheet) → C23, packages 1 + 2 |
| Advocate F4 | should | expired stock/documents as red attention cards | **confirmed** (`pantry/attention.ts:22`, `vault/attention.ts:32` use `danger`) → C24, package 2; overview-head verdict changed to "nachschärfen" |
| Advocate F5 | nit | calendar/timetrack share the HourStrip | **confirmed** → C25, package 1 |
| Advocate F6 | nit | blind test not cold | **agreed**, noted in 01-findings (C35); cold re-run in the packages' acceptance |
| Advocate F7 | nit | weather no-place head empty on desktop too | **confirmed** (empty-pages sheet) → C26, package 1 |
| Advocate F8 | nit | "seit 12 Tagen" counter in the invoices widget | **confirmed** → C27, package 1 |
| Advocate F9 | nit | library band tint reads as a module; three controls per card | **confirmed** → C28, package 0 (library tint); card controls left to the library owner |
| Advocate F10 | nit | two filled primaries on todos/timetrack | **confirmed** → C29, package 1 |
| Advocate F11 | nit | "Modulfarben" placement | → C30, package 0 (link from the focus section) |
| Advocate F12–F19 | blocker/should | confirm F03, G02, F10, F09/F05, F11, G01/G03/G04/G05, F01/F02, F06 | already in the packages |
| Advocate F20 | nit | phone "Satz eintragen" icon-only | **confirmed** → C31, package 0 |
| Advocate F21 | nit | i18n of identity texts complete and natural | confirmed |

Contradictions settled with evidence: the audit's T06 said the spinner never stops – the Guardian's reading of `global.css` is right (global `animation-iteration-count: 1 !important`); the audit's F03 list of seven – the Guardian is right that three of them sit on surface cards; the audit's "overview head bestätigt" – the Advocate's `danger` finding (C24) stands, verdict changed. The Architect's challenge to the palette verdict (the in-area angle rule is redundant) is accepted and the verdict reworded.
