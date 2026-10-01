# Nemo design specification (working document)

Status: **rounds 1–5 decided; round 6 (motion) in progress.** Updated after every round. Decided items are facts; open items are a list. Implementation prompt: [`IMPLEMENTATION-PROMPT.md`](IMPLEMENTATION-PROMPT.md) (written in round 8). Mockups: [`mockups/`](mockups/). Round reports: [`ROUND-1-DIAGNOSIS.md`](ROUND-1-DIAGNOSIS.md).

Guiding idea (from the brief): pleasant and easy to use every day, calm, clear, easy on the eyes, not overloaded.

## 0. Decided in round 1 (maintainer's answers, 2026-10-01)
- **Main use: desktop, mouse-heavy.** Click paths and visible controls count more than shortcuts; keyboard stays a bonus. Phone is secondary but must not break (P1).
- **Dark theme first.** Mockups and token work start dark; light is derived and checked, not the other way round.
- **Must keep:** free-text quick capture (FAB → sentence → local parser), movable home widgets (order, size, hide, synced), a sidebar that shows every active module (no icon-only rail as the default), Nemo orange and the fish.
- **All four pains confirmed:** home does not show "today" (P3), flat navigation and rigid bottom nav (P5), tall cards and phone wrapping (P1, P8, P9), accent doubling and the FAB everywhere (P2).
- **New input:** "I sometimes have to search a lot – maybe modules can be combined." → round 3 brings a proposal for grouping and merging modules in the navigation (information architecture), without changing module code boundaries.

## 1. Principles (decided 2026-10-01, round 2)
1. **Heute zuerst.** The home screen answers "what needs me today" without scrolling: date, counts, the day list, due money.
2. **Eine Hauptaktion pro Ansicht.** One filled accent per screen; everything else uses accent as text/icon colour. FAB only on the phone.
3. **Daten vor Dekoration.** Names, numbers and dates carry the hierarchy. No badge, colour or icon that does not help a decision.
4. **Zeilen statt Karten.** Entries are rows (one line of facts, two on narrow widths); cards only group. Density follows content, not the module.
5. **Gleiches sieht gleich aus.** One list row, one segmented control, one page head, one empty state, one dialog/sheet pattern for all modules.
6. **Bewegung nur als Rückmeldung.** Motion confirms what the user did (tick, save, open); navigation does not animate.
7. **Ruhe durch Weglassen.** Fewer borders and labels, generous edges, tight centres; dark is the reference theme, light is derived and checked for AA.

## 1b. Direction (decided 2026-10-01, round 2) – "D", a mix
- **Colour and space from A:** near-neutral dark page (#101417 family, no blue cast), cards one step lighter, 16 px base, 44 px rows, generous gaps and card padding, thin 1.5 px icons.
- **Row dividers from B:** entries inside a card are separated by hairlines (1 px, low-contrast); cards themselves have no border.
- **Depth from C:** cards sit on the page as layered surfaces with a soft shadow (and a 1 px inner highlight in dark); the top bar may be translucent. No page gradient.
- **Accent: Nemo orange only.** Teal (`--accent-2`) stays for charts and focus ring only; status colours separate.
- **Gradients: brand only** (splash, empty states, fish). No gradients on page, cards, buttons.
- Reference mockup: `mockups/round-2/variant-d.html` (next to A for comparison).

## 2. Layout (desktop / phone)
- Facts today: sidebar 248 px from 900 px, bottom nav 5 slots (Home + 3 modules + Mehr) below; page widths narrow 45 rem / content 70 rem / wide 100 rem / full; split views from 1500 px viewport.
- **Decided (round 3):** hybrid shell – L1 grouped sidebar (248 px: favourites, then collapsible areas with their modules, Bibliothek/Einstellungen at the bottom) that **collapses to the L2 icon rail** (76 px, areas as icons) by a click on the sidebar edge and automatically below 1200 px viewport. Rail state device-local.
- **Decided:** top bar = search ("Suchen oder fragen", Ctrl+K) · one primary "+ Neu" (quick capture, pre-selects the current module's type) · Werkzeuge with label · sync badge; logo = home. **No FAB on desktop.**
- **Decided:** master–detail from **1200 px** viewport (list + panel `clamp(22rem, 30%, 30rem)`), below as sheet/dialog. Ultrawide ≥ 2200 px: content max 1800 px centred, panel 32 rem, home grid 4 columns.
- **Decided:** phone = bottom nav **by area** (Heute · Planen · Geld · Haushalt · Mehr) + FAB (quick capture); area page shows its modules as a scrollable tab row; editors open as bottom sheets.
- Wireframes: `mockups/round-3/layout-l1.html` (sidebar state) and `layout-l2.html` (rail state).

## 3. Navigation and module order
- Facts today: flat manifest order, not configurable; bottom nav takes the first three modules.
- **Decided (round 3):** 7 areas – **Heute** (home) · **Planen** (Kalender, ToDos, Erinnerungen, Geburtstage, Habits, Zeiterfassung) · **Geld** (Finanzen, Rechnungen, Abos, Budgets, Verträge) · **Haushalt** (Einkauf, Vorräte, Packlisten, Geschenkideen) · **Wissen** (Notizen, Merkliste, Nachrichten, Links) · **Tresor** (Accounts, Dokumente) · **System** (desktop: Datenträger, Systeminfo). Each area is a page; its modules are sub-views (tabs). Implementation: an `area` field on the manifest; modules stay separate in code and data; disabled modules vanish from their area; an area with no enabled module is hidden.
- **Decided:** favourites chosen by the user (star in the menu or settings), max 5, synced; shown above the areas. No automatic reordering.
- Later candidates (not decided): Erinnerungen as a tab inside Kalender, Merkliste inside Notizen.

## 4. Home screen
- Facts today: widget grid 1/2/3/4 columns at 44/70/95 rem container width, sizes s/m/l, edit mode, synced layout.
- Proposed (round 2 D + round 3 § 3): greeting + date + count strip; "Heute" the only L widget top-left; hero number per widget; two-line rows; actions inside widgets. **Not decided yet.**

## 5. Tokens (colour, radius, shadow, spacing)
- Facts today: `web/src/ui/tokens.css` (light default, dark twice, accents orange/teal/coral/lagoon, radii 8/10/14/18, shadows only floating, motion 120/200/250 ms).
- **Decided (round 4):** neutral base **cool**. Dark: page `#0f1316`, card `#171c20`, chip/track `#1f2529`, hairline `#262d32`, input border `#6b767e`, text `#eceff1` / `#aab4bb` / `#88939b`. Light: page `#f3f4f4`, card `#ffffff`, chip `#eaecee`, hairline `#e2e5e8`, input border `#76838c`, text `#171f24` / `#55636b` / `#5f6c75`.
- **Decided:** accent orange `#ff9a57` (dark) / `#b5430c` (light), contrast `#1b0f06` / `#ffffff`, soft `#2e241c` / `#fbe9de`; status danger/success/warning/info dark `#f4a39c` / `#7fd3a3` / `#e8b85a` / `#7cc7e8`, light `#b3261e` / `#1b7545` / `#8a5a00` / `#1f5fa8`; soft status backgrounds = `color-mix(status 15%, transparent)`; charts `--viz-1` `#4fb3ad` / `#16847f`, `--viz-2` `#ff9a57` / `#c94f12`, further series `--border-strong`; focus `#ffb07a` / `#0b6f72` as a 2 px outline with 2 px offset.
- **Decided:** teal is no UI colour any more (charts + light focus ring only). Accent variants teal/coral/lagoon stay as user options replacing `--accent*`.
- **Decided:** depth without gradients: level 0 page, level 1 card (no border, shadow `0 1px 0 rgb(255 255 255 / .04) inset, 0 8px 24px rgb(0 0 0 / .35), 0 1px 2px rgb(0 0 0 / .3)` dark / `0 1px 2px rgb(23 31 36 / .06), 0 8px 24px rgb(23 31 36 / .07)` light), level 2 menu/dialog/sheet/FAB (`0 16px 48px rgb(0 0 0 / .45), 0 2px 6px rgb(0 0 0 / .3)` / `0 16px 48px rgb(23 31 36 / .18), 0 2px 6px rgb(23 31 36 / .08)`); top bar and bottom nav `color-mix(--bg 85%, transparent)` + blur 12 px + 1 px hairline. Gradients brand only.
- **Decided:** radii sm 8 / md 12 / lg 16 / xl 20 / full; spacing 4 / 8 / 12 / 16 / 24 / 32 / 48; card padding 22–24; grid gap 24; row 44 (phone 48). Full tables with contrast ratios: `ROUND-4-TOKENS.md`.

## 6. Typography
- Facts today: Inter Variable (local), scale xs 12 → 3xl clamp(32–44), weights 400/500/600/700, tabular numerals.
- **Decided (round 4):** Inter Variable stays the only family (local, OFL). Scale: hero `clamp(2rem, 1.6rem + 1.2vw, 2.75rem)`/700/1.1 · h1 32/600/1.1 (phone 28) · h2 20/600/1.25 · body 16/400/1.5 · label 15/500 · meta 13/400 `--text-3` · caps 11/600/+6 % · badge 12. Letter-spacing −0.02 em at ≥ 28 px. Tabular numerals for every amount, time and date.
- **Decided:** icons Lucide only, 20 px at 1.5 px stroke (1.75 at 16 px, rail 22 px); no filled icons, no emoji. Empty state: fish 64 px at 35 % in `--text-3`, one sentence, one button; no module illustrations.

## 7. Components
- **Decided (round 5, full tables in `ROUND-5-COMPONENTS.md` § 1):** button hierarchy primary (filled, once per view) / secondary (border) / quiet (text) / danger (text; filled red only in the confirm dialog) / row 28–32 px with 44 px hit area / icon 40 px square · inputs: label above, 44 px, radius 12, 1 px `--border-strong`, focus 2 px ring + 2 px offset, error = red border + sentence, hint 13 px · switch 44×26, checkbox 24, segmented 38 px pill (filters only), chips 32, tabs underline (sub-views) · card = grouping only (radius 16, level-1 shadow, no border) · **ItemRow is the single list pattern** (44 px, phone 48, hairline, hover actions, selected `--accent-soft`, done strike) · table only for Buchungen and Zeiterfassung · dialog desktop 34/40 rem radius 20, **bottom sheet on the phone**, backdrop 55 % without blur, draft kept 30 s · toast bottom centre with Rückgängig, 6 s, max 2 · badges = status only · loading Skeleton, empty fish 56–64 px, error inline box with retry.
- **Decided:** module-level copies of Segmented, progress bars and inputs are removed in favour of `@/ui`.
- **Decided:** "+ Neu", `N` and the FAB open **quick capture everywhere** (text → parsed chips; Tab cycles type, Enter creates, Ctrl+Enter opens the full form pre-filled; inside a module its type is pre-selected). Full form: required fields first, optional behind "Mehr" chips, footer Abbrechen · Speichern und neu · Speichern, first field auto-focused, validation on blur/submit. Inline add stays for ToDos, Einkauf, Packlisten.

## 8. Interaction (keyboard, touch, undo)
- Facts today: Ctrl+K palette, Alt+Home, Esc; FAB → quick capture; no other shortcuts.
- **Decided (round 5):** full keyboard scheme: `Ctrl+K` search/ask · `N` new · `G` then `H/P/G/A/W/T` go to area · `J/K` or arrows select row · `Enter` open, `E` edit, `Space` tick · `Ctrl+Z` undo (last 10, also after the toast) · `?` shortcut sheet · `Esc` close/clear · `/` list search. Single letters never fire inside inputs. Palette gets "Neu: …" and area commands.
- **Decided:** row actions on hover/focus; drag-and-drop stays (ToDos, home, Einkauf); multi-select via checkbox / Shift-click / long press with a bulk bar (Erledigt · Verschieben · Löschen · Abbrechen); swipe right = done/paid, left = move/snooze; undo everywhere through the toast and `Ctrl+Z`; soft delete with a 30-day Papierkorb page under Einstellungen.
- **Decided:** focus ring 2 px on everything interactive; focus moves to `main` on navigation, into dialogs on open, back to the opener on close. Reduced motion = all durations 0, shimmer static.
- **Decided:** settings "Textgröße Normal/Groß" (16/18 px root) and "Dichte Normal/Kompakt" (rows 44/36, gaps 24/16), both device-local.

## 9. Motion
- Facts today: transform/opacity only, page fade+slide 250 ms, list stagger, reduced motion zeroes durations.
- open (round 6)

## 10. Modules
- open (round 7)

## 11. Accessibility
- Facts today: AA tokens tested, axe in e2e (light/dark, desktop/Pixel 7), touch 44 px rule (3 known exceptions).
- open

## 12. Open items (all rounds)
- Language of this spec: English (repo convention); the implementation prompt will be German like the maintainer's prompts – confirm.
- `docs/design/` is not exempt in `web/scripts/check-docs.mjs` (budget warnings only) and `docs/CHATS.md` has no row for this branch – both left untouched on purpose (brief: only `docs/design/**`); decide at PR time.
- Round 1 questions: see `ROUND-1-DIAGNOSIS.md` § 5.
