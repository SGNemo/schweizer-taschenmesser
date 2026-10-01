# Nemo design specification (final, 2026-10-01)

Result of the eight-round design evaluation with the maintainer (rounds: [1 diagnosis](ROUND-1-DIAGNOSIS.md) · [2 direction](ROUND-2-DIRECTION.md) · [3 layout](ROUND-3-LAYOUT.md) · [4 tokens](ROUND-4-TOKENS.md) · [5 components](ROUND-5-COMPONENTS.md) · [6 motion](ROUND-6-MOTION.md) · [7 modules](ROUND-7-MODULES.md)). Everything below is **decided** unless listed under § 13. The implementation prompt is [`IMPLEMENTATION-PROMPT.md`](IMPLEMENTATION-PROMPT.md). Mockups (standalone HTML + PNG) live in [`mockups/`](mockups/); the reference renders are named per section.

Guiding idea: pleasant and easy to use every day, calm, clear, easy on the eyes, not overloaded. Main use: desktop with the mouse; dark theme first; phone must never break.

## 1. Principles
1. **Heute zuerst.** The home screen answers "what needs me today" without scrolling: date, counts, the day list, due money.
2. **Eine Hauptaktion pro Ansicht.** One filled accent per screen; everything else uses accent as text/icon colour. FAB only on the phone.
3. **Daten vor Dekoration.** Names, numbers and dates carry the hierarchy. No badge, colour or icon that does not help a decision.
4. **Zeilen statt Karten.** Entries are rows (one line of facts, two on narrow widths); cards only group. Density follows content, not the module.
5. **Gleiches sieht gleich aus.** One list row, one segmented control, one page head, one empty state, one dialog/sheet pattern for all modules.
6. **Bewegung nur als Rückmeldung.** Motion confirms what the user did (tick, save, open); navigation does not animate.
7. **Ruhe durch Weglassen.** Fewer borders and labels, generous edges, tight centres; dark is the reference theme, light is derived and checked for AA.

Direction "D": colour and space from "Ruhig und luftig" (A), hairline row dividers from "Dicht und effizient" (B), layered depth from "Weich mit Tiefe" (C); orange is the only accent; gradients brand-only. Reference: `mockups/round-2/variant-d.html`.

## 2. Shell and layout
| | Decision |
|---|---|
| Desktop shell | **Hybrid sidebar**: 248 px with Favoriten (≤ 5, starred, synced), then collapsible **Bereiche** with their modules, Modul-Bibliothek + Einstellungen at the bottom. One click on the edge handle (or automatically below **1200 px** viewport) collapses it to a **76 px icon rail** (areas as icon + label, Werkzeuge, Einstellungen). Rail state is device-local (setting "Seitenleiste: Breit/Schmal"). Mockups: `round-3/layout-l1.html` (wide), `layout-l2.html` (rail). |
| Top bar | search "Suchen oder fragen" (Ctrl+K, max 28 rem) · **one primary "+ Neu"** (quick capture) · "Werkzeuge" icon **with label** · sync badge (no endless spin) · logo = Home. Translucent (`color-mix(--bg 85%, transparent)` + blur 12 px) with a 1 px hairline. **No FAB on desktop.** |
| Page frame | eyebrow = area name, h1 = module/view, sub-tabs (underline) for the area's modules, toolbar row (filters, period, segmented view switch), then content. Page widths: narrow 45 rem (Einstellungen content 44 rem), content 70 rem, wide 100 rem, full. |
| Master–detail | from **1200 px** viewport: list + detail panel `clamp(22rem, 30%, 30rem)` (sticky); below: detail as sheet/dialog. Applies to Rechnungen, Abos, Verträge, Buchungen, Notizen, Accounts, Dokumente, Nachrichten, Kalender (agenda), Datenträger. |
| Ultrawide ≥ 2200 px | content max 1800 px centred in the content area, panel 32 rem, home grid 4 columns, type stays 16 px (user can choose "Groß"). |
| Window snapping / 1280 laptops | sidebar → rail automatically below 1200 px; split views fold to dialogs below 1200 px. |
| Phone (< 900 px) | bottom nav **by area**: Heute · Planen · Geld · Haushalt · Mehr (sheet with Wissen, Tresor, System, Werkzeuge, Bibliothek, Einstellungen); FAB bottom-right = quick capture; page "+" = module's own type; area page shows its modules as a scrollable tab row; editors and details are **bottom sheets**. Top bar: logo, search, Werkzeuge icon. |

## 3. Navigation and information architecture
- **Seven areas** (manifest field `area`; modules stay separate in code and data; disabled modules vanish from their area; an area with no enabled module is hidden): **Heute** (home) · **Planen** (Kalender, ToDos, Erinnerungen, Geburtstage, Habits, Zeiterfassung) · **Geld** (Finanzen, Rechnungen, Abos, Budgets, Verträge) · **Haushalt** (Einkauf, Vorräte, Packlisten, Geschenkideen) · **Wissen** (Notizen, Merkliste, Nachrichten, Links) · **Tresor** (Accounts, Dokumente) · **System** (desktop only: Datenträger, Systeminfo). Order inside an area = manifest `order`.
- **Favourites:** chosen by the user (star in the sidebar/settings), max 5, synced; shown above the areas; no automatic reordering. Default on a fresh install: Kalender, ToDos, Finanzen.
- **Werkzeuge** stay a sheet (tile grid, 44 px tiles with labels, search on top, 3 recent tools first), reachable from the top bar label and the palette.
- **Palette (Ctrl+K)** adds "Neu: ToDo / Termin / …", the area pages and settings sections.
- **Module set per area follows the module plan** (`docs/product/MODULE-PLAN.md`, target picture B): Planen = Kalender (with the tab „Erinnerungen“ after package 5), ToDos · Geld = Finanzen, Rechnungen, Abos, Budgets · Haushalt = Listen (`lists`: Einkauf, Packliste, Checkliste), Vorräte · Wissen = Notizen, Merkliste (incl. Lesezeichen) · Tresor = Accounts, Unterlagen (`vault`, incl. former Verträge) · Personen (`people`: Geburtstage + Geschenke; area assignment – Planen or Wissen – is decided in package 4) · System = Dieser PC (`disk` with tabs Laufwerke · System). Retired: Nachrichten, Habits, Zeiterfassung. Areas with their remaining modules are hidden when empty.
- **Decided (module review 2026-10-01):** Erinnerungen are merged into Kalender in package 5 (events with `kind` Termin/Erinnerung and `notify`, tab „Erinnerungen“); Merkliste stays its own module and absorbs Links (`launcher`) in package 3.

## 4. Home screen ("Heute")
- Header: greeting ("Guten Morgen/Tag/Abend") + full date + count strip (Termine, Erinnerungen, überfällige Rechnungen, ToDos) + "Anpassen". Setting "Begrüßung und Datum" can hide the greeting.
- Grid: container-query columns 1 / 2 / 3 / 4 at 44 / 70 / 95 rem; **"Heute" is the only L widget**, top-left, spans 2 columns; small widgets flow into the remaining columns (column-based flow, no stretched rows). Phone order: Heute, ToDos, Rechnungen, Kontostand, Abbuchungen, Einkauf, Geburtstage, Erinnerungen.
- Widget anatomy: title 15/600 → hero number 32/700 → sub line 14 → rows (two-line on narrow) → "Modul →" link. **Actions inside widgets:** tick ToDos, "Bezahlt" on invoices, snooze reminders, tick shopping chips. Edit mode (drag, size s/m/l, hide, reset) stays. Vault and desktop modules show status only.
- Reference: `mockups/round-4/home.html` (`home--cool-dark-desktop.png`, `home--cool-dark-phone.png`).

## 5. Tokens
Neutral base **cool**; every pair checked AA (`ROUND-4-TOKENS.md` has the ratios). Hex values are the implementation targets for `web/src/ui/tokens.css`.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0f1316` | `#f3f4f4` | page, sidebar, rail |
| `--surface` | `#171c20` | `#ffffff` | cards, widgets, panels, dialogs, inputs |
| `--surface-2` | `#1f2529` | `#eaecee` | chips, segmented track, skeleton, placeholders |
| `--border` | `#262d32` | `#e2e5e8` | hairline row dividers, top/bottom bar line |
| `--border-strong` | `#6b767e` | `#76838c` | input and secondary-button borders (≥ 3:1 on surface-2) |
| `--text` | `#eceff1` | `#171f24` | body, titles, amounts |
| `--text-muted` (text-2) | `#aab4bb` | `#55636b` | secondary text, nav items |
| `--text-3` (new) | `#88939b` | `#5f6c75` | meta, captions, eyebrows (≥ 4.5:1 on surface-2) |
| `--accent` | `#ff9a57` | `#b5430c` | primary action, active nav, links, "Termin" |
| `--accent-hover` | `#ffb07a` | `#963709` | hover on filled primary |
| `--accent-contrast` | `#1b0f06` | `#ffffff` | text on filled accent |
| `--accent-soft` | `#2e241c` | `#fbe9de` | active nav bg, selected row, Termin chip |
| `--danger` / `--success` / `--warning` / `--info` | `#f4a39c` / `#7fd3a3` / `#e8b85a` / `#7cc7e8` | `#b3261e` / `#1b7545` / `#8a5a00` / `#1f5fa8` | status text; soft bg = `color-mix(in srgb, <status> 15%, transparent)` (replaces the four `-soft` hexes) |
| `--viz-1` / `--viz-2` | `#4fb3ad` / `#ff9a57` | `#16847f` / `#c94f12` | chart series 1/2; further series `--border-strong` |
| `--focus` | `#ffb07a` | `#0b6f72` | `outline: 2px solid` + `outline-offset: 2px` (replaces the 3 px box-shadow ring) |
| `--overlay` | `rgb(0 0 0 / .55)` | `rgb(0 0 0 / .45)` | dialog backdrop, no blur |
| `--shadow-1` (level 1) | `0 1px 0 rgb(255 255 255 / .04) inset, 0 8px 24px rgb(0 0 0 / .35), 0 1px 2px rgb(0 0 0 / .3)` | `0 1px 2px rgb(23 31 36 / .06), 0 8px 24px rgb(23 31 36 / .07)` | cards, widgets, panels (no border) |
| `--shadow-2` (level 2) | `0 16px 48px rgb(0 0 0 / .45), 0 2px 6px rgb(0 0 0 / .3)` | `0 16px 48px rgb(23 31 36 / .18), 0 2px 6px rgb(23 31 36 / .08)` | menus, dialogs, sheets, FAB, toast, drag overlay |
| `--ocean-from/to` | unchanged | unchanged | **brand only**: splash, empty-state fish, images |
| Removed | `--accent-2`, `--accent-2-soft`, `--surface-glass`, `--danger-soft` … `--warning-soft` | | teal is no UI colour (charts via `--viz-1`, light focus keeps teal); soft backgrounds via `color-mix` |

- Accent variants teal / coral / lagoon stay as user options and replace only `--accent*`.
- Radii: `--radius-sm` 8 (chips in rows, kbd) · `--radius-md` 12 (buttons, inputs, nav items, icon buttons) · `--radius-lg` 16 (cards, widgets, panels) · `--radius-xl` 20 (dialogs, sheets) · full.
- Spacing: 4-px grid `--space-1…7` = 4 / 8 / 12 / 16 / 24 / 32 / 48; card padding 22–24; grid gap 24 (compact 16); row height 44 (phone 48, compact 36); hairline 1.
- Depth: level 0 page (solid) · level 1 cards (shadow-1, no border) · level 2 floating (shadow-2). Top bar / bottom nav translucent + blur 12 px. No gradients outside brand surfaces.
- Reference: `mockups/round-4/tokens.html` (`tokens--cool-dark-desktop.png`, `tokens--cool-light-desktop.png`).

## 6. Typography and icons
- **Inter Variable**, local, OFL, the only family; `--font-mono` system stack for tokens/keys only.
- Scale: hero `clamp(2rem, 1.6rem + 1.2vw, 2.75rem)`/700/1.1 · h1 32/600/1.1 (phone 28) · h2 20/600/1.25 · body 16/400/1.5 · label 15/500 · meta 13/400 `--text-3` · caps 11/600/+0.06 em uppercase · badge 12/600. Letter-spacing −0.02 em at ≥ 28 px. Weights 400/500/600/700 only.
- `font-variant-numeric: tabular-nums` on every amount, time, date, counter, table.
- Hierarchy in a row: title 16/400 `--text`, meta 13 `--text-3`, amount 16/600 right. In a widget: title → hero → sub → rows.
- Root size follows the setting "Textgröße": Normal 16 px / Groß 18 px; everything is rem-based.
- Icons: **Lucide** only, 20 px at **1.5 px stroke** (1.75 at 16 px; rail 22 px). No filled icons, no emoji. Empty state: fish mark 56–64 px at 35 % in `--text-3`, one sentence, one button; no module illustrations.

## 7. Components (`web/src/ui`)
| Component | Spec |
|---|---|
| Button | primary = filled accent, **once per view** (page head or dialog foot) · secondary = 1 px `--border-strong` · quiet = text (Abbrechen, side paths) · danger = text in `--danger`, filled red only in confirm dialogs · row button 28–32 px with 44 px hit area · icon button 40 px, radius 12, `--surface-2`. Disabled 45 % opacity. Hover: background change, no transition; press: scale .97. |
| Fields | label above (never placeholder-as-label), 44 px, radius 12, 1 px `--border-strong`, focus = 2 px `--focus` outline + 2 px offset; error = `--danger` border + sentence below; hint 13 px `--text-3`; date fields show a human hint ("Montag, in 6 Tagen"); search fields with icon, in the page head/toolbar. `SelectField` replaces native `<select>` styling. |
| Switch / Checkbox / Segmented / Chips / Tabs | switch 44×26 accent-on; checkbox 24 px radius 7 accent fill; segmented 38 px pill track `--surface-2`, active = `--surface` + accent text (filters only); chips 32 px, active `--accent-soft`; tabs = underline (sub-views). All hit areas ≥ 44 px. **Module-level copies of Segmented, progress bars and inputs are removed.** |
| Card | grouping only: radius 16, shadow-1, no border, padding 22–24, title 15/600, optional hero. |
| ItemRow | **the single list pattern**: 44 px (phone 48, compact 36), hairline between rows, radius 10 on hover/selected; left checkbox/icon/avatar; main = title + 13 px meta (stacked on narrow); right = tabular amount/date; row actions appear on hover/focus (desktop) or by swipe (phone). Selected `--accent-soft`; done = `--text-3` + strike. `ItemList` grid mode is kept only for Links tiles and Werkzeuge. |
| Table | only Finanzen Buchungen and Zeiterfassung: caps header, hairlines, right-aligned tabular amounts, income in `--success`. |
| Dialog / Sheet | desktop centred dialog 34 rem (forms) / 40 rem (quick capture), radius 20, shadow-2, backdrop `--overlay` without blur; phone = bottom sheet with grab handle, max 88 vh, keyboard-safe; Esc / backdrop / swipe-down closes, draft kept 30 s, confirm only if fields were filled. Setup assistant keeps full-screen. Focus into the dialog on open, back to the opener on close; `data-autofocus` on the first field. |
| Toast | bottom centre, shadow-2, icon + sentence + **Rückgängig**, 6 s, max 2 stacked; every state-changing action gets one. |
| Badge | status only: Termin (accent-soft), Erinnerung (surface-2), überfällig (danger 15 %), bezahlt (success 15 %), läuft ab (warning 15 %), Beta/Info (info 15 %). Never decorative. |
| States | loading = `Skeleton` (3 bars, shimmer, static under reduced motion); empty = `EmptyState` (fish, sentence, button) / `compact` in widgets; error = inline box (icon, sentence, retry); sync errors in the shell banner, not toasts. |
| Progress | `ui/Progress` (`scaleX`) everywhere (Budgets, Packlisten, setup, vault meter). |
| Quick capture | "+ Neu", `N`, FAB: one text field → locally parsed chips (type, amount, date, recurrence, account default); `Tab` cycles the type, `Enter` creates, `Ctrl+Enter` opens the full form pre-filled; inside a module its type is pre-selected. Phone: sheet. Reference `mockups/round-5/quickadd.html`. |
| Full form | required fields first (big amount with sign toggle in finance), optional behind "Mehr" chips expanding inline; footer Abbrechen · Speichern und neu · **Speichern**; validation on blur and submit, focus to the first error. Inline add row stays for ToDos, Einkauf, Packlisten. Reference `mockups/round-5/form-rechnung*.html`. |
| Reference sheet | `mockups/round-5/components.html` (`components--dark.png`, `components--light.png`). |

## 8. Interaction
- **Keyboard (desktop):** `Ctrl+K` search/ask · `N` new (quick capture) · `G` then `H/P/G/A/W/T` go to area (Heute, Planen, Geld, hAushalt, Wissen, Tresor) · `J/K` or arrows select row · `Enter` open, `E` edit, `Space` tick · `Ctrl+Z` undo (last 10, also after the toast) · `?` shortcut sheet · `Esc` close / clear selection · `/` focus list search · `Alt+Home` stays. Single letters never fire inside inputs or dialogs.
- **Mouse:** row actions on hover; right-click = same menu as "…"; drag-and-drop (dnd-kit) for ToDo order, home widgets, Einkauf, calendar move/resize (15-min steps).
- **Multi-select:** checkbox / Shift-click ranges / long press → bulk bar (Erledigt · Verschieben · Löschen · Abbrechen).
- **Touch:** swipe right = done/paid (green reveal 72 px), swipe left = move/snooze; long press = multi-select; pull-to-refresh only with sync on.
- **Undo everywhere:** every write via `createRepo` is undoable through the toast and `Ctrl+Z`; deletes are soft with a 30-day "Papierkorb" page under Einstellungen (tombstones exist; GC stays as today).
- **Focus:** 2 px ring on everything interactive; focus moves to `main` on navigation (kept), into dialogs on open and back on close.
- **Settings (device-local):** Textgröße Normal/Groß · Dichte Normal/Kompakt · Seitenleiste Breit/Schmal · Bewegung follows the OS (read-only note).

## 9. Motion
- Durations `--dur-fast` 120 / `--dur` 200 / `--dur-slow` 250 ms; closing in half; easing `cubic-bezier(.22,1,.36,1)` entering, `cubic-bezier(.2,0,0,1)` state changes, linear crossfades. Only `transform`/`opacity` (+ `background`/`border-color` on controls ≤ 44 px); never width, height, surface colour, shadow, blur.
- Patterns: tick (box 120, check scale 200, strike; row leaves after 600 ms via translateX 16 + fade 250, next row moves up) · save = press scale .97 + toast translateY 24→0 250 · dialog = backdrop fade 200 + scale .96→1, sheet translateY 250 · **page/area/tab switch = 120 ms crossfade + tab indicator translateX 200** · skeleton shimmer (only loop) → content fade 200 · chart bars scaleY 250 + 30 ms stagger on first appearance only · drag lift shadow-2 + scale 1.02, settle 200 · badge pop once.
- Removed: `pageIn`, `itemIn` stagger, `pillIn`, endless sync spin (one pulse when a sync ends), backdrop blur, width/colour/shadow transitions. `prefers-reduced-motion`: all durations and delays 0, shimmer static.
- Reference: `mockups/round-6/motion.html` + frames.

## 10. Modules
Decided per module in [`ROUND-7-MODULES.md`](ROUND-7-MODULES.md) § 1–2 (table for all 25). Highlights:
- **Kalender:** week = time grid 07–21 h (44 px/h), all-day row (ToDos with date, birthdays, invoices), today column tint 5 %, now line, one colour per kind (Termin accent, Erinnerung grey, extern info), overlapping items share width; agenda column 22 rem from 1200 px; phone default Agenda, week = 3 days, month = dot grid; slot click creates, drag moves. `mockups/round-7/kalender.html`.
- **Finanzen:** hero "Verfügbar" + breakdown line, 3 KPI cards with delta, 6-month bar chart, categories as rows with inline bars, Buchungen side column; Buchungen tab = table. Phone: KPIs as one-line rows. `finanzen.html`.
- **Rechnungen / Abos / Verträge / Budgets:** rows with sums in the toolbar, panel details, "Bezahlt" row button; Abos without a visible switch label; Budgets with `ui/Progress`. `mockups/round-3/layout-l1.html`.
- **Tresor (Accounts):** status pill "Entsperrt · Windows Hello", "Sperren" always visible, auto-lock countdown in the panel, per-row copy, secret rows (reveal/copy), TOTP ring, health line; red only for weak/reused; lock screen = one centred card; widget status only. `tresor.html`.
- **Datenträger:** treemap keeps its categorical palette (documented exception) + accent selection outline; detail panel with facts, Korb with "Frei danach", one primary "In den Papierkorb"; safety text once. `datentraeger.html`.
- **Systeminfo** folds into Dieser PC (`disk`, tab „System“) per the module plan; Datenträger spec applies to the Laufwerke tab.
- **Einstellungen:** section list left (16 rem), content 44 rem, option rows ≥ 56 px, segmented instead of native selects, order Darstellung · Favoriten & Bereiche · Übersicht · Benachrichtigungen · Sync & Backup · KI-Assistent · Werkzeuge · Tresor & Sicherheit · Lokale API · Einrichtung (end, when data exists) · Über Nemo; phone = chip row + stacked options. `einstellungen.html`.
- **ToDos, Erinnerungen, Geburtstage, Habits, Zeiterfassung, Einkauf, Vorräte, Packlisten, Geschenkideen, Notizen, Merkliste, Nachrichten, Links, Dokumente, Systeminfo, Werkzeuge, Setup-Assistent:** per the table (rows instead of card grids, panels/sheets, quick capture where sensible, inline add kept, widgets with hero + rows + action).

## 11. Accessibility
- Contrast: all token pairs AA (text ≥ 4.5:1 on bg/surface/surface-2, UI ≥ 3:1), guarded by `ui/tokens.test.ts` extended with `--text-3`, `--border-strong` on `--surface-2`, status on surface, `--focus` on surface, both dark blocks identical.
- Targets ≥ 44 px everywhere (segmented 38 px visual + padding, checkbox 24 px + hit area); phone rows 48 px.
- Focus visible on everything; dialogs trap focus; `aria-current`, live regions for toasts and drag announcements (kept).
- Reduced motion = no motion; "Textgröße Groß" = 18 px root; "Dichte Kompakt" never below 36 px rows.
- axe (`e2e/a11y.spec.ts`) extended to seeded data, `data-theme` and accent variants, both densities.

## 12. Repo rules that stay untouched
Internal identifiers (`io.github.sgnemo.taschenmesser`, storage keys `tm-*`, DB name, backup ids, package names), security and signing, vault crypto, AI privacy (no user data to models, `accounts` without `aiSchema`/widget entries), local API rules, data envelope and `createRepo`, module isolation (areas are navigation only). The Disk block list, typed confirmation and recycle-bin-first stay as they are.

## 13. Open items (not decided, implementation may propose)
- ~~Merging Erinnerungen into Kalender and Merkliste into Notizen~~ – answered by the module review: Erinnerungen → Kalender in package 5; Merkliste stays (see § 3).
- Exact favourites UI (star in sidebar hover vs. settings list only); default favourites on a fresh install.
- Papierkorb page scope (which collections, 30-day purge vs. manual).
- Werkzeuge: whether the sheet becomes an area page on the phone.
- Phone week view = 3 days vs. 1 day with horizontal swipe.
- `docs/design/` is not exempt in `web/scripts/check-docs.mjs` (this file exceeds the 3 000-token budget, warning only); `docs/CHATS.md` has no row for this branch – both deliberately untouched (brief: only `docs/design/**`); decide at merge time.
