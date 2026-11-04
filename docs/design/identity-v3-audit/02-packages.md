# Identity v3 – audit, phase 2: proposals · phase 4: fix packages

Follows [01-findings.md](01-findings.md) (finding ids F01–F15, G01–G17, T01–T08). Maintainer decisions after phase 1 (2026-11-04): **foundation package first** for the head silhouettes (F01/F02); **Dieser PC as its own small package** (G01); **E-Mail back to `schreib` + stamp** (F04/G13); **one package for the empty states** with an `EmptyState motif` prop and every module ported (F11).

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
_(written after the council)_
