# Nemo design specification (working document)

Status: **rounds 1–2 decided; round 3 (layout, navigation, module order) in progress.** Updated after every round. Decided items are facts; open items are a list. Implementation prompt: [`IMPLEMENTATION-PROMPT.md`](IMPLEMENTATION-PROMPT.md) (written in round 8). Mockups: [`mockups/`](mockups/). Round reports: [`ROUND-1-DIAGNOSIS.md`](ROUND-1-DIAGNOSIS.md).

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
- Proposed (round 3, `ROUND-3-LAYOUT.md` § 2–3): L1 grouped sidebar (collapsible to rail) / L2 rail + area column / L3 top navigation; master–detail from 1200 px; ultrawide content 1800 px centred; one "+ Neu" in the top bar, FAB only on the phone; editors as bottom sheets on the phone. **Shell not decided yet.**

## 3. Navigation and module order
- Facts today: flat manifest order, not configurable; bottom nav takes the first three modules.
- Proposed (round 3, § 1): 7 areas – Heute, Planen, Geld, Haushalt, Wissen, Tresor, System – each an area page with the modules as sub-views (`area` field in the manifest, no code merge); favourites (3–5) at the top; phone bottom nav by area or by module. **Not decided yet.**

## 4. Home screen
- Facts today: widget grid 1/2/3/4 columns at 44/70/95 rem container width, sizes s/m/l, edit mode, synced layout.
- Proposed (round 2 D + round 3 § 3): greeting + date + count strip; "Heute" the only L widget top-left; hero number per widget; two-line rows; actions inside widgets. **Not decided yet.**

## 5. Tokens (colour, radius, shadow, spacing)
- Facts today: `web/src/ui/tokens.css` (light default, dark twice, accents orange/teal/coral/lagoon, radii 8/10/14/18, shadows only floating, motion 120/200/250 ms).
- open (round 4)

## 6. Typography
- Facts today: Inter Variable (local), scale xs 12 → 3xl clamp(32–44), weights 400/500/600/700, tabular numerals.
- open (round 4)

## 7. Components
- open (round 5)

## 8. Interaction (keyboard, touch, undo)
- Facts today: Ctrl+K palette, Alt+Home, Esc; FAB → quick capture; no other shortcuts.
- open (round 5)

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
