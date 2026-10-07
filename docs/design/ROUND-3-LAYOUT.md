# Design evaluation – round 3: layout and information architecture (2026-10-01)

Wireframes in the decided look D: [`mockups/round-3/`](mockups/round-3/) – `layout-l1|l2|l3.html` (+ PNG: desktop 1920, wide 2560, phone 412, dark; desktop light). All three show the same page, **"Geld → Rechnungen" with a detail panel**, because it exercises the two things that change most: areas that combine modules, and master–detail on wide screens. The home screen keeps the round-2 layout (variant D).

## 1. Areas instead of a flat list (answer to "ich muss manchmal viel suchen")
Proposal: the navigation shows **7 areas**, each area is a page with its modules as sub-views. Modules stay separate in code (own manifest, data, widgets); only the navigation and the page frame change (a manifest field `area` + the area page renders the module routes as tabs). Nothing is merged at the data level, nothing is lost.

| Area | Modules (sub-views, in order) | Why together |
|---|---|---|
| **Heute** | the home screen | start page, not a module |
| **Planen** | Kalender · ToDos · Erinnerungen · Geburtstage · Habits · Zeiterfassung | everything with a date or a daily rhythm; Erinnerungen and Geburtstage already appear inside the calendar |
| **Geld** | Finanzen · Rechnungen · Abos · Budgets · Verträge | one money page; Rechnungen/Abos/Budgets already depend on Finanzen |
| **Haushalt** | Einkauf · Vorräte · Packlisten · Geschenkideen | things in the house and shopping; Vorräte → Einkauf already linked by event |
| **Wissen** | Notizen · Merkliste · Nachrichten · Links | reading, writing, collecting |
| **Tresor** | Accounts · Dokumente | locked things, own lock screen |
| **System** (desktop only) | Datenträger · Systeminfo | machine, not life |

Candidates for a real merge later (not now): Erinnerungen as a tab inside Kalender (one "Termine & Erinnerungen" list), Merkliste inside Notizen. Favourites (3–5 pinned modules at the top) give one-click access to what you use daily; the area stays the fallback for everything else.

## 2. Three shell layouts
| | L1 Gruppierte Sidebar | L2 Rail + Bereichsspalte | L3 Top-Navigation |
|---|---|---|---|
| Desktop | sidebar 248 px: Favoriten, then collapsible areas with their modules; Bibliothek/Einstellungen at the bottom | 76 px icon rail with the 7 areas + Werkzeuge/Einstellungen; a 220 px column shows the active area's modules and two key numbers | no sidebar; areas as pills in the top bar, modules as sub-tabs under the page title |
| Where things sit | search + "+ Neu" + Werkzeuge (labelled) + sync in the top bar | same top bar; Werkzeuge also in the rail | logo left, areas, search right, "+ Neu", Werkzeuge, sync, settings |
| Content width | 1920: 1600 px; 2560: 1800 px, centred in the remaining space | widest content (rail is narrow); detail panel grows on 2560 | fully symmetric on 2560; content 1800 px centred |
| Phone | bottom nav by **module** (Übersicht, Kalender, ToDos, Finanzen, Mehr) | bottom nav by **area** (Heute, Planen, Geld, Haushalt, Mehr); the area page shows its modules as a scrollable tab row | same as L2 |
| Strengths | closest to today ("sidebar with all modules" stays true); scanning by eye; favourites | most room for content; master–detail is natural (area column = first level); calm rail | nothing left of the content; perfect on ultrawide and in half-screen snapping; modules one tab away |
| Weaknesses | long when all areas are open; the sub-tabs repeat the sidebar entries (drop one of them) | module names only visible after choosing an area; two left columns on a 1280 laptop cost 300 px | areas are text pills (7 + search + buttons = crowded under 1400 px); vertical scanning gone |
| Window snapping (half of 1920 = 960 px) | sidebar collapses to the rail | area column folds into a popover | top pills become a "Bereiche" menu |

Honest assessment: **L2 fits "desktop, mouse, dark, many modules" best**; L1 is the safe evolution of today; L3 is the prettiest on ultrawide but the weakest at 1280. A hybrid is possible: L1's sidebar that *collapses to L2's rail* with one click (and automatically under 1200 px). I would recommend **L1 with collapse-to-rail** if "all modules visible" matters more than content width, otherwise **L2**.

## 3. Rules that hold in every layout
- **Top bar:** search left-centre ("Suchen oder fragen", Ctrl+K), **one** "+ Neu" (primary, opens quick capture; inside a module it pre-selects that type), Werkzeuge with a label, sync badge. Logo = home. No FAB on desktop.
- **Phone:** bottom nav with 4 slots + Mehr; FAB bottom-right opens quick capture; the "+" in the page head creates the page's own type. Editors open as **bottom sheets**.
- **Master–detail** from **1200 px viewport** (today 1500): list left, detail panel right `clamp(22rem, 30%, 30rem)`; below that the detail opens as a sheet/dialog. Applies to Accounts, Rechnungen, Abos, Verträge, Buchungen, Notizen, Kalender (agenda).
- **Ultrawide (≥ 2200 px):** content max 1800 px centred in the content area, detail panel 32 rem, home grid 4 columns; type stays 16 px (a "Groß" text-size setting is a separate decision, round 5).
- **Home:** greeting + date + counts; grid 1/2/3/4 columns at 44/70/95 rem container width; "Heute" is the only L widget and sits top-left; widgets get a hero number and a two-line row style; widget actions (tick, Bezahlt) directly in the widget.

## 4. Scenarios – interactions per layout (desktop, from Home; phone in brackets)
| Scenario | Today | L1 | L2 | L3 |
|---|---|---|---|---|
| Morning overview | 0 + 1–2 scrolls (0 + 3) | 0, no scroll on 1920 (0 + 2) | 0 (0 + 2) | 0 (0 + 2) |
| Capture quickly | FAB → text → Enter = 2 (2) | "+ Neu" → text → Enter = 2 (2) | 2 (2) | 2 (2) |
| Tick off an invoice | 2 (3) | 1 via widget button, or Favorit Rechnungen → Bezahlt = 2 (Geld tab → Rechnungen → Bezahlt = 3) | 1 via widget; Geld → Rechnungen → Bezahlt = 3 (3) | 1 via widget; Geld → Rechnungen → Bezahlt = 3 (3) |
| Check a subscription | 0–1 (2) | 0 (widget) / Favorit = 1 (3) | 0 / Geld → Abos = 2 (3) | 0 / 2 (3) |
| Get a password | 4 (5) | Favorit Accounts → unlock → entry → copy = 4 (Mehr → Tresor → unlock → entry → copy = 5) | Tresor → unlock → entry (panel from 1200 px) → copy = 4 (5) | 4 (5) |
| Look at an appointment | 0–2 (2) | 0 (Home) / Favorit Kalender = 1 (1) | 0 / Planen → Kalender = 2 (Planen = 1, Kalender is the first tab) | 0 / 2 (1) |
| Clean up the PC | 5 | System → Datenträger → … = 5–6 | same | same |

Net: the areas cost **one extra click for non-favourite modules** and save the sidebar scroll, the "Mehr" sheet hunt on the phone and the module-name search; favourites and widget actions bring the daily cases to 0–2.

## 5. Questions for round 3 (asked in chat)
1. Shell: L1 (sidebar, collapsible to rail), L2 (rail + area column) or L3 (top navigation)?
2. Areas and assignment as proposed (7 areas, names Heute/Planen/Geld/Haushalt/Wissen/Tresor/System)? Changes?
3. Phone bottom nav: by area (Heute, Planen, Geld, Haushalt, Mehr) or by module (today's style, configurable favourites)?
4. Favourites: fixed by you in settings, or automatic from use?
