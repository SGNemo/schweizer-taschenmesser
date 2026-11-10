# Identity v3.1 – acceptance sweep (phase 1, `qa/identity-v3-sweep`, 2026-11-05)

Acceptance of the fix packages of 02-packages.md (removed 2026-11-10, in the git history) part B on `develop` after #485 (package 0), #493 (1), #489 (2), #490 (3) and planner package 1 (#492). Ids from [01-findings.md](01-findings.md). Rules: [MODULE-IDENTITY.md](../MODULE-IDENTITY.md), DESIGN-SPEC §4a, planner identity and wording: [plan/CONCEPT.md](../plan/CONCEPT.md) §1, §7.

## Method

- Seeded Dev-Preview (`build:e2e-seed`, scale `medium`, clock 2026-09-29), every module on (desktop poses as the Windows app). Capture: tools/sweep.spec.ts (removed 2026-11-10, in the git history) + tools/playwright.sweep.config.ts (removed 2026-11-10, in the git history) (copy into `web/` like the audit specs). 1920 × 1080 and 390 × 844, light and dark, seeded and empty: 25 module pages (head crop + viewport), overview (full + every widget), `/library`, `/library/planner`, `/tools`, `/settings`, `/settings/darstellung`, `/settings/module/planner`, toolbox panel; planner checks (board, Sunday, ToDo views with the planner on, widgets); the maintainer's points with the reading aid at 100 %; a client-side route change on the phone. 17 + 1 runs green.
- Overflow: `document` and `main` scroll width at every captured page, both sizes, both themes, seeded and empty: **0 px everywhere** (8 fact files).
- Checks: `npm run check:modules` (26 modules, 16 tools) and `check:tools` (16) green, **no warnings**; `noStripes`, `tokens`, `registry`, `widgets`, `exclusion` and `scripts/lib` tests: 440 green.
- **Cold blind test (C35):** a fresh subagent that had seen nothing of the app scored 108 crops (heads + widgets, 1920 light + dark, titles blacked out) against the mapping table only; key read after scoring. All recognised; **heads by form alone 41 / 50 (82 %, audit 69 % warm)**, **widgets by form alone 15 / 54 (28 %)** – the rest needed reading, colour or the header icon. Weakest identities named by the cold reader: chat, subscriptions, invoices, vault + planner widgets, pantry (N05).

## Sheets (`shots/`)

| Sheet                                  | File                                                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Heads 1920 light / dark                | `sweep-heads-light-1920.jpg`, `sweep-heads-dark-1920.jpg`                                                                     |
| Heads 390 light / dark                 | `sweep-heads-light-390.jpg`, `sweep-heads-dark-390.jpg`                                                                       |
| Widgets 1920 / 390 light               | `sweep-widgets-light-1920.jpg`, `sweep-widgets-light-390.jpg`                                                                 |
| Empty pages 1920 light, empty chat     | `sweep-empty-pages-light-1920.jpg`, `sweep-empty-chat.jpg`                                                                    |
| Planner 1920 / 390, library + settings | `sweep-planner-1920.jpg`, `sweep-planner-390.jpg`, `sweep-library-settings-planner.jpg`                                       |
| Maintainer's points                    | `sweep-sven-sidebar-toolbox-1920.jpg`, `sweep-sidebar-stale-ink.jpg`, `sweep-sven-phone-390.jpg`, `sweep-sven-topbar-390.jpg` |

## Status per finding

Status: **erledigt** · **teilweise** · **offen**. Rest = effort left (S < ½ day, M 1–2 days, – none).

| Id  | Paket     | Status               | Beleg                                                                                                                                                | Rest                   |
| --- | --------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| F01 | 0         | erledigt             | heads-1920: figure + slot side by side in the 70 rem column                                                                                          | –                      |
| F02 | 0         | erledigt             | heads-1920: compact `fokus`/`schreib`/`tresor` vs hero heads differ in silhouette                                                                    | –                      |
| F03 | 0         | erledigt             | `--text-on-tint` (84 % / 94 %), head-ink guard in `tokens.test.ts`                                                                                   | –                      |
| F04 | 0         | erledigt             | app-wide rule in `checkIdentity.ts`, `check:modules` green                                                                                           | –                      |
| F05 | 0         | erledigt             | `KennzahlBody`/`KachelnBody`/`FortschrittBody`/`NotizBody` in use (widgets-1920); recognition see N05                                                | –                      |
| F06 | 0 + 4 | erledigt (4) | areas folded except the current page's, hand choice kept (`tm-nav-open`); 1080 no longer scrolls (`p4-f06-before-after`) | – |
| F07 | 0         | erledigt             | neutral group tint in sidebar and library                                                                                                            | –                      |
| F08 | 0         | erledigt             | `--focus` on the accent hue, `--info` warning test                                                                                                   | –                      |
| F09 | 0         | erledigt             | `align-items: start`, widgets keep their height (overview)                                                                                           | –                      |
| F10 | 0 + 1 + 2 | erledigt             | "Heute geschafft", "Browser-Lesezeichen"; `widgets.test.tsx`                                                                                         | –                      |
| F11 | 0 + 1 + 2 | erledigt             | `EmptyState motif` in 25 module files (empty-pages); only `DownloadsEmpty` stays local                                                               | –                      |
| F12 | 0         | erledigt             | `@/ui/identity` blocks (Receipt … Envelope, WeekBars)                                                                                                | –                      |
| F13 | 0         | erledigt (phase 2)   | rule in MODULE-IDENTITY "Tools"; `check:tools` lists 3 tool/module kinships as information (`toolModuleKinship`, test)                               | –                      |
| F14 | 0         | erledigt             | settings categories without pattern; planner settings head with signature S (library-settings)                                                       | –                      |
| F15 | 1 + 2     | erledigt             | notes, mail, calendar, todos by page width (window only as fallback)                                                                                 | –                      |
| G01 | 3         | erledigt             | disk head: figure + drive rings, slate (heads-1920)                                                                                                  | –                      |
| G02 | 2         | erledigt             | bubble, paper, address bar, envelope stay at 390 (heads-390)                                                                                         | –                      |
| G03 | 2         | erledigt             | vault `FolderTabs` with counts (heads-1920/390)                                                                                                      | –                      |
| G04 | 1         | erledigt             | invoices `fokus`: open sum, bill mark, „Nächste bezahlen“                                                                                            | –                      |
| G05 | 1         | erledigt             | budgets envelopes in the slot (heads, sven-phone)                                                                                                    | –                      |
| G06 | 2         | erledigt             | pinboard in slot M (still small at 1920, recognised strong in the cold test)                                                                         | –                      |
| G07 | 2 + 4 | erledigt (4) | bubbles carry two ink lines and three still typing dots, G02 size (`p4-g07-before-after`) | – |
| G08 | 2         | erledigt             | notes paper beside the title, phone too; recognised strong                                                                                           | –                      |
| G09 | 0 + 2     | erledigt             | `masthead` id, feeds head                                                                                                                            | –                      |
| G10 | 1         | erledigt             | habits widget rings                                                                                                                                  | –                      |
| G11 | 1         | erledigt             | maps pin + `KachelnBody` tiles                                                                                                                       | –                      |
| G12 | 0 + 1 + 4 | erledigt (4) | `SIGNATURES`: `hourStrip` → `stopwatch`, own mark + dial block; settings head and empty motif (`p4-g12-settings-before-after`) | – |
| G13 | 2         | erledigt             | mail paper + stamp, one "Posteingang" widget                                                                                                         | –                      |
| G14 | 1         | erledigt             | receipt (lists) vs bill (invoices); orchid shared by different heads (allowed)                                                                       | –                      |
| G15 | 0         | erledigt             | scratch link `data-hue` violet, `--module-color`                                                                                                     | –                      |
| G16 | audit     | erledigt             | `--module-color-2`                                                                                                                                   | –                      |
| G17 | rest | erledigt | at the end of a page nothing is covered: the shell's `.main` keeps bottom-nav + 6rem below the content (`layout/AppShell.module.css`, one place, > FAB 56 px + gap); the sweep shot was mid-page, where a floating button lies over content by design | e2e `shell.spec.ts` „G17“ at 390 px (desktop + Pixel 7): last board day ends above the FAB; red with the padding removed (779 > 708), green with it |
| T01 | –         | erledigt             | 0 px overflow, all pages, both sizes, themes, seeded and empty                                                                                       | –                      |
| T02 | –         | erledigt             | checks + 440 tests green, no warnings                                                                                                                | –                      |
| T03 | –         | erledigt             | G15/G16 fixed, disk palette on tokens                                                                                                                | –                      |
| T04 | –         | erledigt             | `--text-on-tint` on the band, guards in `tokens.test.ts`                                                                                             | –                      |
| T05 | –         | erledigt             | state/focus/info rules tested                                                                                                                        | –                      |
| T06 | –         | erledigt             | global reduced-motion rule (council correction)                                                                                                      | –                      |
| T07 | –         | erledigt             | `NoReadAid` around the whole frame for vault/accounts (C05); exclusion test green                                                                    | –                      |
| T08 | –         | nicht neu gemessen   | no perf re-run in this sweep                                                                                                                         | –                      |
| C01 | 0 + 3     | erledigt (phase 2)   | bars/rings in `--module-color`; "Systemlaufwerk" badge neutral (`sweep-fix-c01-disk-before-after`)                                                   | –                      |
| C02 | 0         | erledigt             | 25° check per `data-accent` block                                                                                                                    | –                      |
| C03 | 2         | erledigt             | `MusicHero` calm/off guard                                                                                                                           | –                      |
| C04 | 2         | erledigt             | vault agenda items without titles                                                                                                                    | –                      |
| C05 | 0         | erledigt             | `router.tsx` wraps the frame                                                                                                                         | –                      |
| C06 | 0         | erledigt             | `--text` on the group tint                                                                                                                           | –                      |
| C07 | 0 + 1     | erledigt             | no rating rail; `noStripes` sees `box-shadow`                                                                                                        | –                      |
| C08 | 0         | erledigt             | `feedback`/`widgetType` rejected by the registry, frame draws `identity.signature`                                                                   | –                      |
| C09 | 0         | erledigt             | one `HeadSurface` for band, settings head, tool stage                                                                                                | –                      |
| C10 | 0 + 2     | erledigt             | compact heads stay compact; music head compact on the phone                                                                                          | –                      |
| C11 | 0 + 4 | erledigt (4) | 28 raw weights → `--weight-*` (550/650 → semibold, 400 → normal); `checkFontWeights` in `check:modules` fails on new ones | – |
| C12 | 0         | erledigt             | `categoryLook.ts` + test                                                                                                                             | –                      |
| C13 | 0         | erledigt             | no angle parsing, hue equality only                                                                                                                  | –                      |
| C14 | audit     | erledigt             | MODULE-IDENTITY clarification                                                                                                                        | –                      |
| C15 | 0         | erledigt             | spreading removed, manifest order                                                                                                                    | –                      |
| C16 | 0         | erledigt             | compact bar title from state                                                                                                                         | –                      |
| C17 | 0         | erledigt             | calm drops tint and pattern through tokens                                                                                                           | –                      |
| C18 | 0 + 4 | erledigt (4) | `clipped-text.spec.ts` by region (widget/head/row/page), 360 + 1920, planner + all widgets; first run: phone 0/4/1, desktop 3/3/39 | – |
| C19 | 1         | erledigt             | calendar grid by page width                                                                                                                          | –                      |
| C20 | 0         | erledigt             | tools draw through `SignatureMark`                                                                                                                   | –                      |
| C21 | 0         | erledigt             | two fillers left by design (`headline` for finance, `HeroSlot figure`); shell branch gone                                                            | –                      |
| C22 | 1         | erledigt             | phone ToDo head: title with „…“, „Später“, name „Anfangen · 5 Min: …“ (sven-phone)                                                                   | –                      |
| C23 | 1 + 2     | erledigt (phase 2)   | chat: empty state title + motif only, the setup hint is the one filled action, „Neuer Chat“ secondary until then (`sweep-fix-c23-chat-before-after`) | –                      |
| C24 | 2         | erledigt             | pantry/vault attention `warning`                                                                                                                     | –                      |
| C25 | 1         | erledigt             | timetrack `Stopwatch`                                                                                                                                | –                      |
| C26 | 1         | erledigt             | weather without place keeps the sky and one step                                                                                                     | –                      |
| C27 | 1 + 4 | erledigt (4) | with N08: every `DueList` names the day, invoices on the shared label | – |
| C28 | 0         | erledigt             | library head slate                                                                                                                                   | –                      |
| C29 | 1         | erledigt             | one filled primary on todos/timetrack                                                                                                                | –                      |
| C30 | 0         | erledigt             | link from "Fokus & Aufmerksamkeit"                                                                                                                   | –                      |
| C31 | 0 + 4 | erledigt (4) | phone shows „Eintragen“ beside a small icon; full name stays label + tooltip (`p4-c31-before-after`) | – |
| C32 | audit     | erledigt             | rule in MODULE-IDENTITY                                                                                                                              | –                      |
| C33 | 0         | erledigt             | widget head zone assertion                                                                                                                           | –                      |
| C34 | 1 + 2     | erledigt             | timetrack fish; accounts is a status widget, not an empty state                                                                                      | –                      |
| C35 | –         | erledigt             | cold re-run above                                                                                                                                    | –                      |

## Maintainer's screenshot points

| Point                                    | Status                  | Beleg                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topbar (phone, route change)             | erledigt                | in-app tap on „Geld“: bar there after 120 ms (`sweep-sven-topbar-390`); the collapse itself did not trigger in emulation – hand test of #481 stays                                          |
| Focus ring (toolbox)                     | erledigt                | ring on the search field on open, on the first entry after Tab (1920); phone opens on the list                                                                                              |
| Scratch-pad wrap                         | erledigt                | „Schmierzettel“ in one piece with the aid at 100 % (1920 + 390)                                                                                                                             |
| **Sidebar reading aid on active switch** | erledigt (phase 2, N07) | before: Kalender → Budgets left „**Kal**ender“ with the dimmed rest of the active ink (`sweep-sidebar-stale-ink`); after: every inactive entry alike (`sweep-fix-n07-sidebar-before-after`) |
| Budgets                                  | erledigt                | envelopes in the head, chips in the toolbar, red only for „Freizeit 144 %“                                                                                                                  |
| Lesezeichen                              | erledigt                | „Lesezeichen“ (bookmarks links) vs „Browser-Lesezeichen“; pinboard head                                                                                                                     |
| Chat                                     | teilweise               | empty page fixed (C23); head bubbles still weak (G07, package 4)                                                                                                                            |
| ToDo head                                | erledigt                | one card, title, „Später“; phone shortened. Seam with the planner: N02                                                                                                                      |
| Kalender head                            | erledigt                | day leaf + hour strip with blocks + next appointment                                                                                                                                        |
| Dieser PC                                | erledigt                | head, rings, tokens; small rest C01 (badge)                                                                                                                                                 |

## Planner (new module, checklist "new or converted module")

| Check                              | Status         | Beleg                                                                                                                                                   |
| ---------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manifest identity, `check:modules` | erledigt       | indigo/cobalt, `kennzahl`/`fortschritt`, `weekBars`, `thin`; order 15 between `zeit` and `fokus` (neighbour rule)                                       |
| Head: one figure                   | erledigt       | „7 Min frei heute“; context „1 Ding · 5 Min geplant · KW 40“ (as CONCEPT §1, KW included)                                                               |
| Signature `weekBars` in `HeroSlot` | erledigt       | beside the figure at 1920, under it at 390, light and dark                                                                                              |
| Widget variant                     | erledigt       | `ProgressList` bars, „Bis Fr: … geplant · … frei“, no red                                                                                               |
| Empty / day off                    | erledigt       | Sunday head „Heute ist frei.“; empty page „Noch nichts geplant. Eine Sache reicht.“ with the weekBars motif                                             |
| Rows title + minutes               | erledigt       | rows „~30 Min · Frist Mi“; blockers greyed with minutes                                                                                                 |
| Colour distance                    | erledigt       | indigo 26° from cobalt and violet (palette test); cold test: planner head strong, widget only by reading (N05)                                          |
| ToDo page: „im Plan: Mi“           | erledigt       | Bald view: 14 rows „im Plan: Mo … Sa“                                                                                                                   |
| ToDo page: „Neu planen“ hidden     | erledigt       | 0 buttons on all, Bald and Heute views                                                                                                                  |
| „Heute“ card in plan order         | erledigt (N02) | next = the planner's today item ✓; but the card counts **10 Heute · etwa 65 Min** (8 waiting + 2 today) while the planner says **1 Ding · 5 Min** (N02) |
| Board at 1920                      | erledigt (N01) | seven columns of ~210 px: titles break inside words („Urlaubsant/rag“, „Steuererkl/ärung“) (N01)                                                        |
| No overflow at 390                 | erledigt       | day strip scrolls inside itself; page 0 px                                                                                                              |
| Library card                       | erledigt (4)   | the sketch of `fortschritt` is a ring, same as habits; the planner widget is bars (N06)                                                                 |

## New findings

| Id  | Finding                                                                                                                                                                                                                                      | Owner                                                      | Rest                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01 | Planner board: titles break inside words in the 7-column board at 1920 (column ~210 px with checkbox and padding).                                                                                                                           | planner package 2 (`modules/planner/*`)                    | S · **erledigt** (`fix/planner-sweep`): no split inside a word, two lines + „…“, seven columns from 95rem; e2e 1280–1920; `shots/sweep-fix-n01-board*.jpg`                                          |
| N02 | ToDo head „10 Heute · etwa 65 Min“ vs planner „1 Ding · 5 Min“; the ToDo „Wartet noch · Alle auf heute“ group stays while the planner already put those items on later days (rewrites `plannedFor`, against CONCEPT §7 "what gets removed"). | planner package 2 (`todos/today.ts`, todos page condition) | S–M · **erledigt** (`fix/planner-sweep`): a later planner day beats an old due date in Heute/head/„Als Nächstes“; „Alle auf heute“ hidden; unit + e2e; `shots/sweep-fix-n02-todos-before-after.jpg` |
| N03 | Planner icon `calendarDays` next to Kalender's `calendar`: two calendar glyphs in neighbouring sidebar rows.                                                                                                                                 | planner manifest                                           | S · **erledigt** (`fix/planner-sweep`): `chartGantt`; `shots/sweep-fix-n03-icon-before-after.jpg`                                                                                                   |
| N04 | Planner page: the toolbar row holds only the ⋯ menu above the field (≈ 100 px empty row at 1920).                                                                                                                                            | planner package 2                                          | S · **erledigt** (`fix/planner-sweep`): ⋯ beside „Eintragen“; `shots/sweep-fix-n04-toolbar-before-after.jpg`                                                                                        |
| N05 | Cold blind test: widgets of the indigo/cobalt family (planner, subscriptions, vault, bookmarks, downloads, browser) are told apart only by text or header icon; the head motif does not reach the overview. **Erledigt in package 4:** every widget head draws its `SignatureMark` at the right end (ink, `aria-hidden`); cold reader 6/6 by the mark alone, grayscale, titles + icons hidden (`p4-n05-blind`). | package 4 proposal (widget marks)                          | – |
| N06 | Library `WidgetMiniature` draws `fortschritt` as a ring for every module (planner = bars, habits = rings). **Erledigt in package 4:** `WidgetMiniature` draws rings for `ring`/`gauges`, bars for the rest (`p4-n06-g12-before-after`). | library owner                                              | – |
| N07 | Sidebar reading aid kept stale ink after the active module changes. **Fixed in phase 2:** `ReadableText` watches `class`/`aria-current` of the link around it (unit test fails without the fix).                                             | shell                                                      | –                                                                                                                                                                                                   |
| N08 | „seit gestern / seit n Tagen“ remains in the pantry widget and every `DueList` overdue label (`core/time/due.ts`), the counter C27 removed from invoices. **Erledigt in package 4:** „war am Di. fällig“ / „war am 17. Sep. fällig“, pantry „MHD war Mo.“, test per language (`p4-n08-before-after`). | foundation / module owners                                 | – |

## Open points ≤ 1 day and proposal (phase 2)

I would fix myself, one commit per id, before/after shots in the PR:

1. **N07** sidebar stale ink – `ReadableText` measures again when the host control's `class`/`aria-current` changes (MutationObserver on the closest link), unit test. S.
2. **C23** chat empty page – while no AI is set up the hint card is the one action; „Neuer Chat“ and „Chat starten“ step back (hidden or secondary). S.
3. **C11** serif rest – the 8 module CSS files use `var(--font-serif)` (existing token, no token change). S.
4. **C01** disk badge – „Systemlaufwerk“ `tone="accent"` → neutral. S.
5. **F13** – one line in MODULE-IDENTITY "Tools", `check:tools` prints module/tool signature overlaps as information. S.

Not mine (board notes for `feat/plan-calendar-instructions`): N01–N04. Proposed for package 4, not built: N05 (widget marks for the indigo/cobalt family), G07 (chat head), N06, N08 app-wide, C11 raw weights, C18 tooling, G12 `stopwatch` id (contract). Decisions: F06, C31.

## Phase 2 – fixes (after „Plan freigegeben“)

One commit per id: N07 sidebar stale ink (`core/text/ReadableText`, unit test red → green), C23 chat empty page (`modules/chat`, unit test with a mutation check; the unused `chat.emptyAction` removed in five languages, e2e starts from „Neuer Chat“), C11 serif token (6 CSS files, pixel-identical), C01 disk badge, F13 rule + `check:tools` information. After-shots from the rebuilt seeded preview: `shots/sweep-fix-*.jpg`. Left to the maintainer, nothing changed: C27 app-wide counter text (own package), C31 phone write button icon-only, F06 sidebar scroll at 1080. Proposed for package 4, not built: N05, G07, N06, N08, C11 weights, C18 tooling, G12 `stopwatch` id.

## Package 4 – rest points (`feat/identity-v3-polish`)

One commit per id; before/after from the rebuilt seeded preview: `shots/p4-*.jpg`. Maintainer answers: F06 fold areas (a), C31 show the text (a), pantry wording „MHD war Mo.“.

| Id | Change | Proof |
| --- | --- | --- |
| N05 | `home/Home.tsx` widget head: `SignatureMark` of `identity.signature`, right end of the head row, `--text-muted`, `aria-hidden`; mail/chat drop their in-body mark | e2e `home.spec` (every widget, same row as the title); cold reader 6/6 by the mark alone (three only when zoomed: pinboard, arrow band, address bar are small at 22 px) |
| G07 | `Bubble` block: two ink lines + three still dots | `identity.test.tsx`; `p4-g07-before-after` |
| N06 | `WidgetMiniature` `signature` prop, `progressForm()` | `WidgetMiniature.test.tsx` |
| N08 | `core/time/due.ts` `overdueOn`/`pastDay`; `overdueSince`, `invoices.widgetDue` removed (5 languages); FOCUS-WORDING row | `due.test.ts` (each language), e2e `home`/`readability` |
| C11 | 17 CSS files on tokens; `checkFontWeights` | `checkIdentity.test.ts`; `check:modules` red before, green after |
| C18 | `e2e/screenshots/clipped-text.spec.ts` regions + desktop | run on the seeded preview |
| G12 | contract id `stopwatch` | `check:modules`, identity tests |
| F06 | `stores/ui.ts` `openAreas`, `Sidebar` `areaOpen()` | `nav.test.tsx`, `ui.test.ts`, e2e `shell`/`modules`/`readability` |
| C31 | `layout/AreaFrame` `.writeShort` | `p4-c31-before-after` |

Left open after package 4, now **erledigt** (`fix/identity-v3-rest`): the pantry **page** names the best-before day like N08 („MHD war Mo.“ / date, `pantry/logic.ts` `expiryText` over `core/time/due.ts` `pastDay`; `t.pantry.expired` removed in five languages; proof `pantry/__tests__/expiryText.test.ts`, each language), and G17 (row above). N01–N04 were fixed by `fix/planner-sweep` (#497).

**Identity v3.1 abgeschlossen (App + Website); Einstellungs-Identität folgt in `design/settings-identity`.**
