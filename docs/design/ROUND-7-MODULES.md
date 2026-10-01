# Design evaluation – round 7: modules in detail (2026-10-01)

Mockups for the four modules that change most: [`mockups/round-7/`](mockups/round-7/) – `kalender.html`, `finanzen.html`, `tresor.html`, `datentraeger.html` (desktop dark/light, phone dark). Everything else is specified in the table below and inherits shell, tokens, components and motion from rounds 2–6. Every module keeps its data model; what changes is the page frame (area + sub-tabs), the list pattern (ItemRow), create (quick capture + full form), and the widget (hero number + rows + action).

## 1. Mockups
### Kalender (Planen)
- **Week = time grid + agenda** (today: list below 1500 px, grid only above). Grid: 07–21 h visible, 44 px per hour, all-day row on top (ToDos with a date, birthdays, invoices due), today column tinted 5 % accent, red "now" line, overlapping items share the column width. Items: accent block for Termine, grey for Erinnerungen, info-blue for external ICS; one colour per *kind*, never per calendar.
- Agenda column (22 rem, from 1200 px): today, tomorrow, next 7 days; coloured dots by kind; legend once at the bottom. Phone: the segmented offers Monat · Woche · Tag · Agenda; **phone default = Agenda**, Woche shows 3 days (Mo–Mi, swipe), Monat stays the dot grid from today.
- Create: "+ Termin" or `N` → quick capture with date parsing; click on an empty slot creates at that time (desktop); drag to move/resize (dnd-kit, 15-min steps). Detail = side panel (desktop) / sheet (phone).
- Widget "Heute": the day list with kinds, tomorrow below, actions: tick (ToDo), snooze (Erinnerung).

### Finanzen (Geld)
- Overview = hero "Verfügbar" with the one-line breakdown (Kontostand · offene Rechnungen · Abos bis Monatsende), three KPI cards with delta line, 6-month bar chart (two series `--viz-1/2`, y-axis in k, dashed grid), categories as rows with inline bars + percent; Buchungen as a side column (from 1200 px) grouped by day with a category icon, income green. Period segmented Monat · Quartal · Jahr.
- Buchungen tab = the table pattern (date, payee, category, account, amount), filter row (account, category, search), bulk categorise. Konten and Kategorien tabs = rows with inline edit.
- Create: "+ Buchung" → quick capture ("Supermarkt 23,40" → Ausgabe heute, Standardkonto); full form has amount first, big, with a sign toggle.
- Phone: KPIs stack as one-line rows (label · value · delta), chart scrolls horizontally, Buchungen behind a tab.
- Widget "Kontostand": hero + accounts rows + sparkline; "Fällige Rechnungen" gets the Bezahlt action.

### Tresor (Accounts)
- Feeling: calm, orderly, nothing flashy; security shown as **status, not alarm**: a green "Entsperrt · Windows Hello" pill, the auto-lock countdown in the panel, "Sperren" always visible. No red unless a password is weak or reused ("schwach" badge, filter "Schwach").
- List: avatar tile with the initial, title + username, quick copy button per row (copies the password, toast "Passwort kopiert · wird in 30 s gelöscht"). Detail panel (from 1200 px): secrets as grey "secret rows" (label · value · reveal · copy), password masked by default, TOTP with a 30 s ring, website with open button, health line (zxcvbn, reuse, age), history, no amounts of white space.
- Lock screen: centred card, master password field, Windows Hello/biometrics button, nothing else; unlocking returns to the exact spot. Phone: list, detail as sheet; copy button in the row is the main action.
- Widget: status only (locked/unlocked, count, weak count) – never entries (exclusion rule).

### Datenträger (System)
- Treemap keeps its own categorical palette (8 file types, a documented exception) but inherits radius, hairline gaps and the selected outline in accent. Breadcrumb above, scan status right, segmented Karte · Liste · Typen.
- Detail panel (22 rem): folder facts, three actions (Öffnen, In den Korb, Duplikate), then the **Korb** with running total and "Frei danach"; the one primary button is "In den Papierkorb (16,7 GB)". The warning box states the safety rule once (recycle bin first, typed LÖSCHEN for permanent, system folders locked). System folders render in the muted grey and are not selectable.
- Phone/web: module stays desktop-only (no mockup for the phone beyond the unchanged drive cards).

## 2. All modules – what changes (short spec)
| Module (area) | Main view | Detail | Create | Widget | Special |
|---|---|---|---|---|---|
| Kalender (Planen) | see above | panel/sheet | quick capture, slot click, drag | Heute list + actions | time grid, agenda, kinds |
| ToDos (Planen) | lists as a chip row (All · Eingang · Haushalt · Arbeit · +), rows with checkbox, due, priority dot; sections "Überfällig / Heute / Später" | panel with subtasks, notes | inline row at top (kept) + quick capture | "Offene ToDos": hero count + 5 rows + tick | swipe right = done; `Space` ticks; board view stays an idea (ROADMAP) |
| Erinnerungen (Planen) | rows: time, title, recurrence, switch | sheet | quick capture ("Oma anrufen 10:30 täglich") | "Erinnerungen": next 3 + snooze | candidate for a Kalender tab later |
| Geburtstage (Planen) | rows grouped by month, "in N Tagen", age | sheet | quick capture ("Anna 3.10.1950") | "Nächste Geburtstage" | shows in the calendar all-day row |
| Habits (Planen) | rows with 7-day dot strip + today's checkbox, streak | sheet | quick capture | "Heute" strip with ticks | dots not pills; 24 px targets |
| Zeiterfassung (Planen) | timer card (one primary Start/Stop), day groups as table | sheet | quick capture ("Projekt X 2h") | running timer / today total | tabular numbers; export |
| Finanzen (Geld) | see above | panel | quick capture | Kontostand | charts, table |
| Rechnungen (Geld) | rows (payee, due, amount, Bezahlt) with filter Offen · Bezahlt · Alle and sum | panel (round 3 mockup) | quick capture | Fällige Rechnungen + Bezahlt | overdue in `--danger` meta only |
| Abos (Geld) | rows (name, cycle, next date, amount, switch) with monthly/yearly sums | panel | quick capture | Nächste Abbuchungen | **no visible switch label** |
| Budgets (Geld) | rows with inline progress bar (scaleX), remaining amount; Sparziele tab | panel | form | budget bars | progress = `ui/Progress` |
| Verträge (Geld) | rows (name, provider, end date, notice window) with "läuft ab" warning | panel | form | ending soon | warning only when the notice window opens |
| Einkauf (Haushalt) | one list, inline add on top, done items fold below, swipe to tick | – | inline (kept) | open items as chips | shared with Vorräte via event |
| Vorräte (Haushalt) | rows grouped by place, expiry badge, "Nachkaufen" → Einkauf | sheet | form | expiring soon | |
| Packlisten (Haushalt) | lists → items with checkboxes, progress in header | – | inline add | progress per list | |
| Geschenkideen (Haushalt) | rows grouped by person, status chips | sheet | quick capture | next occasion | |
| Notizen (Wissen) | rows (title, first line, pinned on top) + search; editor as panel on desktop | panel/sheet | quick capture ("Notiz: …") | pinned notes | grid → rows; editor gets the width |
| Merkliste (Wissen) | rows with kind icon (lesen/sehen/Ort/Idee), tags as chips, Offen · Erledigt | sheet | quick capture (URL paste) | open items | candidate for Notizen tab |
| Nachrichten (Wissen) | rows with source, time, unread dot; reader as panel | panel | – | headlines (no AI) | no `aiSchema` (kept) |
| Links (Wissen) | tiles stay (launcher), one size, 44 px | sheet | form | – | |
| Accounts (Tresor) | see above | panel | form only (never quick capture) | status only | |
| Dokumente (Tresor) | rows with type icon, size, date; preview panel | panel | upload | status only | |
| Datenträger (System) | see above | panel | – | status (drives) | treemap palette exception |
| Systeminfo (System) | cards → one two-column facts list with live values | – | – | CPU/RAM/battery mini | refresh = one quiet button |
| Werkzeuge (sheet) | tile grid stays, tiles 44 px, labelled, search on top; recent 3 tools first | opens inside the sheet | – | – | reachable via "Werkzeuge" label in the top bar and `Ctrl+K` |
| Einstellungen | left list of sections (desktop) / stacked (phone), content narrow; "Einrichtung" moves to the end for installations with data; native `<select>` → ui `SelectField` | – | – | – | adds Textgröße, Dichte, Favoriten, Bereiche |
| Setup-Assistent | keeps full-screen dialog; step list left, content right; uses the same fields/buttons | – | – | checklist card on Home (kept) | |

## 3. Questions for round 7 (asked in chat)
1. Kalender: week grid 07–21 h with the agenda column, phone default Agenda – accept?
2. Finanzen overview as mocked (hero, 3 KPIs, 6-month bars, categories as rows, Buchungen column) – accept?
3. Tresor: status pill + auto-lock countdown + per-row copy – accept, or more reserved (no countdown)?
4. Any module in the table you want mocked up next, or changed?
