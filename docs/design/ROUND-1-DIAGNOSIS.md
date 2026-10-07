# Design evaluation – round 1: diagnosis (2026-10-01)

State of `develop` @ `a43eb0f` (v0.3.1), rendered with invented data (`npm run screenshots`, `SCREENS_DESKTOP=1`), 1280×720 / 1920×1080 / 2560×1440 / 412×915, light + dark. Annotated screenshots: [`screenshots/round-1/`](screenshots/round-1/) (numbers in the images = problem ids below). Nothing in the app was changed.

## 1. What works today (keep)
- **Token discipline.** One `tokens.css`, AA-checked palette, three weights, type scale, radii, z-index, motion tokens. Any redesign can be done through tokens + `ui/` without touching modules first.
- **Calm palette and type.** Warm off-white page, white cards, Inter, tabular numbers. The finance hero number, the disk drive cards (ring + numbers + badge) and the month calendar on the phone (dots, today marker) are the strongest screens.
- **Shell basics.** Sidebar with clear active state, sticky top bar with search, bottom nav with a pill marker, skip link, focus moved to `main` on navigation, Esc closes dialogs.
- **Command palette.** `Ctrl+K`: modules, settings, full-text hits, calculator, AI question. Already the natural keyboard hub.
- **Quick capture.** FAB → sheet → free text ("Milch kaufen morgen 9:00") parsed locally into ToDo/Termin/Erinnerung/Merkzettel/Buchung/Notiz; plus one link per module.
- **Home screen.** Widgets for every module, drag-and-drop, sizes s/m/l, hide, reset, synced layout. The "Heute & Morgen" list is exactly the right content for the morning.
- **Calendar.** Week/day time grid with an agenda aside from 1500 px; cross-module items (ToDos, reminders, invoices, birthdays, subscriptions) appear in the calendar.
- **Vault.** Lock screen, search, split view with detail panel from 1500 px, copy buttons, TOTP.

## 2. Problems (severity: **S1** blocks daily use / looks broken · **S2** costs time or calm every day · **S3** polish)

### Layout & shell
| Id | Sev | Problem | Where seen |
|---|---|---|---|
| P1 | S1 | **Phone card grids break words.** Subscriptions at 412 px render "Cloud-Speich-er", "Fit ne ss st ud io De m o" (title column squeezed by amount + label + switch). Invoice "Rechnung hinzufügen" button wraps to two lines; the Accounts toolbar wraps "Import, Export & Sicherheit" to three. Cause: fixed side widths, no `min-width: 0`, labels that should be icons on narrow screens. | `412--subscriptions`, `412--invoices`, `412--accounts` |
| P2 | S1 | **Accent overload.** Every page shows two filled orange controls (header primary + global FAB); ToDos shows four (list chip "Alle offenen", "Hinzufügen", header button, FAB). The FAB duplicates the page's own primary and is useless on Settings, Library, System, Disk. Orange stops meaning "the one thing to do here". | every page; `1280--todos` |
| P3 | S2 | **Home does not show "today" at a glance.** 1280×720: only "Heute & Morgen" fits above the fold (18 rows); amounts, invoices, reminders are below. 1920: the L widget is 700 px tall, the s widgets next to it leave ~400 px of empty page under "Offene ToDos"/"Erinnerungen". No date, no greeting, no "what needs me today" summary; widgets are read-only (every action leaves Home). | `1280--dashboard`, `1920--dashboard` |
| P4 | S2 | **Wide screens waste space asymmetrically.** 2560: sidebar fixed left (248 px), content capped at 1600 px and centred → a ~350 px empty band between sidebar and content, 16 px text looks small. 1920 `wide` pages (invoices, subscriptions, notes) stretch two columns to 1600 px → cards 780 px wide with 20 words in them. No density or zoom setting. | `2560--dashboard`, `1920--invoices` |
| P5 | S2 | **Navigation is one flat list in manifest order.** 19 module entries at 1080 px overflow the sidebar (scroll, "Packlisten" cut); no groups (Alltag / Finanzen / Werkzeuge / System), no favourites, no reorder. Bottom nav shows the first three modules by manifest order (Kalender, ToDos, Erinnerungen) regardless of use – Finanzen, Rechnungen, Accounts are two taps away behind "Mehr". | `1920--*`, `412--*` |
| P6 | S2 | **Top bar: icons without words.** Wrench (tools) and sync badge are unlabeled 44 px icons; on the phone the bar is logo + search pill + wrench and nothing says "Werkzeuge". The search pill is a button that looks like an input. | all |
| P7 | S3 | **Page headers are inconsistent.** Some pages have a description line (Datenträger, Bibliothek), most do not; stats sit in three different places (Finance hero, Abos inline pair, Rechnungen single, ToDos none). Settings puts "Einrichtung" first even on an installed app and uses native `<select>` boxes. | `1280--settings`, `1280--subscriptions` |

### Lists, cards, density
| Id | Sev | Problem | Where seen |
|---|---|---|---|
| P8 | S2 | **Card lists are too tall for what they say.** Accounts: 2 entries = 2 cards of 80 px with 70 % white; Abos/Erinnerungen: card + Switch + redundant visible label "Cloud-Speicher: Aktiv" + badge; Rechnungen: two-column grid with mismatched heights, the "Als bezahlt markieren" button wraps under the amount on the third card. On the phone the finance KPI trio (Einnahmen/Ausgaben/Saldo) stacks to a full screen before the chart. | `1280--accounts`, `1280--subscriptions`, `1280--invoices`, `412--finance-overview` |
| P9 | S2 | **No master–detail below 1500 px.** Accounts and Finance open a centred dialog instead of a side panel on 1280/1366 laptops (`SPLIT_QUERY` is a 1500 px viewport query). Calendar week at 1280 is a day list, the time grid appears only at 1500+. | `1280--accounts`, `1280--calendar-week` |
| P10 | S3 | **Week grid readability.** Reminders at the same minute overlap (09:30 "Pflanzen gießen" vs "Team-Meeting"), 1-hour rows with 3-line labels, hour axis starts scrolled to 09:00 with no "now" line visible. | `1920--calendar-week` |
| P11 | S3 | **Horizontal chip rows on the phone are cut without affordance** (ToDo lists "Ar…", finance tabs "Kateg…"). | `412--todos`, `412--finance-overview` |

### Controls, states, motion
| Id | Sev | Problem | Where seen |
|---|---|---|---|
| P12 | S2 | **Create flows are desktop dialogs everywhere.** All module editors are centred `Dialog`s, also on the phone (no bottom sheet, keyboard pushes a 30 rem box). Only quick capture uses the sheet. ToDos/Einkauf add inline (good) but the others need header button → dialog → 4–8 fields → Speichern. | code: `Dialog` default `center` |
| P13 | S3 | **Touch targets under 44 px:** Segmented 36 px, ToDo checkbox 22 px, calendar day numbers 32 px. | code (`Patterns.module.css`, todos) |
| P14 | S3 | **Keyboard stops at Ctrl+K.** No "new entry", no `?` sheet, no list navigation, no shortcut for quick capture on desktop; palette has no "Neu…" command. | `AppShell.tsx` |
| P15 | S3 | **Motion is tidy but not meaningful.** Every page fades + slides 6 px (250 ms) including tab switches inside a module; list stagger; sync badge spins endlessly. Nothing confirms "saved" or "done" except a toast. | `PageContainer.module.css` |
| P16 | S3 | **Empty/loading states differ per module** (8 widgets with own text, "…" placeholders, calendar without `EmptyState`). Known since the 2026-09-30 review. | archive review M8 |

### Dark theme
| Id | Sev | Problem | Where seen |
|---|---|---|---|
| P17 | S2 | **Low separation in the dark theme.** `--surface` #132b3a on `--bg` #0b1d2b with a `--border` of #26485b: cards are visible but flat; the active nav item, chips and badges in `--accent-soft` (#3a2a22, brownish) read muddy next to the blue surfaces; orange #ff9a57 at full strength on large buttons glows. | `dark/*` (see section 4) |

## 3. Daily scenarios – interactions today (desktop / phone, starting on Home)
| Scenario | Desktop | Phone | Where it sticks |
|---|---|---|---|
| Morning overview | 0 clicks + 1–2 scrolls | 0 taps + 3 scrolls | P3: nothing but the day list fits; amounts and invoices are below the fold; on a fresh install the welcome card pushes everything down. |
| Capture something quickly | FAB (1) → type → Enter (2) | FAB (1) → type → Enter (2) | Good. No keyboard route on desktop (P14); the capture type is guessed, the module links below are a second, slower path (3 + form). |
| Tick off an invoice | Sidebar "Rechnungen" (1) → "Als bezahlt markieren" (2) | "Mehr" (1) → Rechnungen (2) → button (3) | The Home widget "Fällige Rechnungen" lists it but offers no action (P3). Bottom nav slot order (P5). |
| Check a subscription | 0 (widget "Nächste Abbuchungen") or Sidebar (1) | "Mehr" (1) → Abos (2) | Fine on desktop; card density on the phone is broken (P1). |
| Get a password | Accounts (1) → master password + Enter (2) → entry (3) → copy (4) | Mehr (1) → Accounts (2) → unlock (3) → entry opens dialog (4) → copy (5) | On 1280 the entry opens a dialog, not the panel (P9). Vault is far down the sidebar (P5). |
| Look at an appointment | 0 (Home list) or Kalender (1); details need day/week (2) | Kalender (1) → day dot (2) | Fine. Month view at 1280 hides "today" below the fold when the month is long. |
| Clean up the PC | Datenträger (1) → drive (2) → scan → node (3) → delete (4) → typed confirmation (5) | n/a | Deliberately slow (safety); fine. Datenträger sits last in the sidebar (P5). |

## 4. Dark theme notes
- The dark theme is the better of the two in rhythm: navy page, slightly lighter cards, orange reads as warm against blue. Month calendar, finance hero and the week grid look good.
- Weak points (P17): `--accent-soft` is a brown (#3a2a22) that fights the blue surfaces (active nav item, "Termin" badges, today column in the week grid, calendar chips); the primary button in #ff9a57 at full size is the brightest thing on the page; `--surface-2` (list chips, segmented track) is almost identical to `--surface`, so grouping relies on borders only.
- Both themes share every structural problem above (P1–P16); none is theme-specific.

## 5. Open questions for round 1 (asked in chat)
1. Which of P1–P17 hurt most? Which do not matter to you?
2. What must not be lost (free-text capture, home widgets, palette, sidebar, the orange, the fish)?
3. Main use: desktop vs phone, keyboard vs mouse, window size(s), light vs dark?
