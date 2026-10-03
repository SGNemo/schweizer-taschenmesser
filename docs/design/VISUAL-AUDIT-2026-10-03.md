# Visual audit 2026-10-03 (final: fixed / open)

Branch `fix/visual-polish-notifications`. Method: Dev-Preview build with `medium` test data, `npm run screenshots` (`e2e/screenshots/capture.spec.ts`), 6 viewports (1280×720, 1920×1080, 2560×1440, 3440×1440, 820×1180, 412×915) × light/dark, 31 pages each. "Before" shots: [`screenshots/visual-audit-2026-10-03/`](screenshots/visual-audit-2026-10-03/) (test data only).

**Coverage so far:** all module main views and all settings categories. **Still to capture before phase 2 ends:** detail/capture dialogs, Command Palette, setup assistant, Werkzeuge sheet, toasts, empty/loading/error states, long-text and many-entry data, half-screen snapping (≈ 640 px wide). Marked "to capture" below where a finding is suspected but unverified.

## Findings

Severity: **H** broken/unusable-looking · **M** visibly inconsistent · **L** polish. Cause = suspected root cause (file under `web/src`).

| # | View / viewport | Problem | Cause | Sev | Group | Status |
|---|---|---|---|---|---|
| 1 | Übersicht 1920, 3440 (`before-1920x1080--dashboard`, `…3440x1440…`) | Cards in one grid row have different heights; large dead areas under short cards ("Als Nächstes", "Kontostand") | `home/Home.module.css` `.grid`: `grid-auto-flow: row dense`, `align-items: start`, no `grid-auto-rows`; s/m/l only set column span (`ui/widgets/size.ts`) | H | A grid | fixed (A) |
| 2 | Übersicht all | Widgets "Als Nächstes", "Heute & Morgen" still show skeletons ~600 ms after load; layout jumps when they fill (to verify: slow or stuck?) | lazy widget data; skeleton height ≠ content height | M | A grid | not a defect: skeletons were load time (capture waited 600 ms); rows now keep their height |
| 3 | Übersicht 820 (`before-820x1180--dashboard`), user screenshot 2 | Lesezeichen chips: "Paketverfolgung" and "Wochenmarkt-Karte" clipped, unequal chip heights | `ui/widgets/Tiles.tsx` + `Widgets.module.css:220-246`: `minmax(7rem,1fr)`, label span has no `min-width:0`, no wrap/ellipsis rule | H | B text | fixed (B) |
| 4 | ToDos ≥ 84 rem (`before-1920x1080--todos`), user screenshot 4 | Subtasks sit in one column of the 2-col list, leaving holes next to them; uneven bottoms | `modules/todos/routes/todos.module.css:144-166`: subtasks are a nested `<ul>` inside the parent `<li>`, grid `align-items:start` | H | A grid | fixed (A) |
| 5 | Merkliste 1920 (`before-1920x1080--bookmarks`), Lesezeichen | Tiles: checkbox not on the title line in some tiles, row heights differ by wrapped lines, empty gaps in the tile column; long titles wrap mid-word | `ui/Patterns.module.css`: `.main {min-width:10rem}`, `overflow-wrap:anywhere`, `.row {flex-wrap:wrap}`, no ellipsis anywhere in `ui/` | M | B text | fixed (B) |
| 6 | Merkliste | Search field is empty, no icon, no placeholder; "Art" select label sits above the segmented control, not on its line | module-local toolbar; no shared `SearchField` | M | D controls | fixed (D, placeholder; icon not added) |
| 7 | Kalender (all) , user screenshot 3 | Two tab rows stacked ("Kalender \| ToDos \| Personen" and "Kalender \| Erinnerungen"); same word twice | `layout/AreaFrame.tsx` + second `<Tabs>` in `modules/calendar/routes/CalendarPage.tsx:98-137` | M | C head | fixed (C) |
| 8 | Kalender | "Heute" button has a strong 1 px border and looks like a focus ring; neighbouring icon buttons have none | `Button.module.css .secondary` border-strong used for a toolbar action | M | D controls | fixed (D) |
| 9 | Kalender Woche 1280 (`before-1280x720--calendar-week`) | Agenda column: badges not aligned to a common column, titles wrap early ("Anna Beispiel wird 29") | agenda row grid has no fixed badge column | M | B text | fixed (B) |
| 10 | Erinnerungen tab (light) | Switch label "Paket abholen: Aktiv" printed beside every switch (visually duplicated title); meta text wraps ("· 17:30" alone on a line) | `RemindersTab.tsx` visible label instead of `aria-label` | M | B text | fixed (B) |
| 11 | Finanzen overview 1920 (`before-1920x1080--finance-overview`), user screenshot 5 | "Tabelle" toggle floats lower than the card title and is the only button in the head; chart cards have dead space under the title; bar chart and table card heights unrelated | `OverviewTab.tsx ChartCard` ghost `Button` min-height 44 px next to a 15 px title | M | D controls | fixed (D) |
| 12 | Banner (all views), user screenshots 1, 4, 5 | In-app reminder card is cut off at the right viewport edge and covers page actions ("+ Buchung", "Hinzufügen"); overlaps top bar; same z-index (60) as toasts | `layout/ReminderPrompt.module.css` `.card` fixed top/right, no safe-area, `--z-toast` | H | F banner (phase 3) | fixed (F: banner off by default, safe areas, bottom option) |
| 13 | Einstellungen 2560, 3440 (`before-2560x1440--settings-allgemein`), user screenshot 6 | Everything tiny on a big monitor: 16 px type, 44 rem content centred in a 2560 px window, huge empty areas left and right; list column and content have different top lines | spec § 2 "type stays 16 px at ≥ 2200 px"; settings page width `--page-narrow`; no fluid root size | H | E scale | fixed (E, fluid root size) |
| 14 | Einstellungen Allgemein | "Dein Name" field is empty, no placeholder, looks broken | `pages/settings/` field without placeholder | L | D controls | fixed (D) |
| 15 | Übersicht/all 2560, 3440 | Sidebar (248 px) and top bar stay at 16 px scale and look lost; content max 1800 px leaves 40 % empty at 3440 | same as 13 | M | E scale | fixed (E) |
| 16 | all, header | Wordmark "Nemo" looks clipped/overlapped by the mark at every size (to verify against the brand SVG) | `layout/Wordmark` / `brand/` | L | open (brand, not touched) | open (brand asset, not touched) |
| 17 | Übersicht 820/412 | Fixed bottom nav + FAB overlap the last row of lists (e.g. calendar month 412) | page bottom padding vs. `--bottom-nav-h` + FAB | M | G mobile | open (not verified after the changes; check on device, V2) |
| 18 | 412 settings, calendar | Settings list OK; right-aligned status ("Aus", "Nicht eingerichtet") collides with chevron and wraps descriptions inconsistently | settings category list row layout | L | B text | open (low) |

Not found so far (checked): horizontal scrollbars at 1280/820/412, elements outside the viewport except #12, focus rings in the shots taken, double dividers.

## Plan (groups by cause, one commit each, before/after shot per group)

- **A Grid and heights (1, 2, 4):** home grid gets `grid-auto-rows` from a row unit and size classes with fixed row spans (s=1, m=2, l=3 rows; content scrolls or shows "+N mehr"); skeletons use the class height. ToDos: subtasks flattened into the grid (`grid-column: 1/-1` under the parent) or parent+subtasks as one block spanning both columns. Snapshot test for the size-class → span table.
- **B Text and truncation (3, 5, 9, 10, 18):** one rule in `ui/Patterns`/`Tiles`: single line + ellipsis + `title` tooltip, or `line-clamp: 2`; `min-width:0` on every flex/grid child; drop `.main {min-width:10rem}`; fixed badge column in agenda rows; switch labels via `aria-label`. Test for truncation classes.
- **C Page head (7):** sub-tabs of a module (Erinnerungen) become the existing `Segmented` in the toolbar instead of a second `Tabs` row.
- **D Controls (6, 8, 11, 14):** shared `SearchField` with icon + placeholder; "Heute" as quiet/tonal button; chart-card head with the toggle as 32 px quiet button on the title baseline; placeholders.
- **E Scale on large screens (13, 15):** needs your decision, see below.
- **F Notifications (12 + task part 3):** see task; banner off by default, notification centre, settings switch, toast position/z-order.
- **G Mobile (17):** bottom padding token for pages with FAB/bottom nav; safe areas.

### Decisions needed from the maintainer
1. **Large-screen scale (13, 15).** Spec § 2 deliberately keeps 16 px type at ≥ 2200 px. Options: (a) fluid root size (16 px up to 1920 px wide, then up to ~20 px at 3440 px via `clamp`), everything is rem-based so layout scales; (b) only widen the settings page; (c) leave as is. Recommendation (a) plus settings width `--page-content`.
2. **Reminder "open" state.** There is no done/due state on reminders (they are calendar events with `kind: 'reminder'`; "done" is a device-local ack key, "snooze" a synced `reminders` entry). The notification centre will derive "open" = notifications that fired (via `collectDue`) and are not acked; the home reminder widget does not exist (reminders live in the "Heute"/"Als Nächstes" widgets) so the two buttons go into "Als Nächstes". Confirm or adjust.
3. **Existing setting `focus.inAppPrompt`** (default today: on, shipped with focus package 2). New default off; users who explicitly switched it on keep it only if their value was stored (default-only users change). Confirm.

## Status
Fixed: 1, 3–15 (2 was a measuring artefact). Open: 16 (brand wordmark, not touched), 17 (phone bottom padding, verify on device), 18 (settings list status text, low).
Decisions taken (plan approved): fluid root size 16 → 20 px; reminder "open" derived from fired notifications; in-app card default off.
Not covered by screenshots in this round: dialogs/capture forms other than the notification centre, Command Palette, setup assistant, Werkzeuge sheet, empty/error states, long-text data, half-screen snapping. The layout e2e (`e2e/layout.spec.ts`, 8 viewports incl. 700 px and 960 px) checks every page for horizontal overflow instead.
After shots: `screenshots/visual-audit-2026-10-03/after-*.png` (1920 dashboard/todos/bookmarks/finance, 1280 calendar, 820 dashboard, 2560 settings, 3440 dashboard, notification centre desktop and phone).
