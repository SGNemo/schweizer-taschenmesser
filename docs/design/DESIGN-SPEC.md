# Nemo design specification (working document)

Status: **round 1 answered; round 2 (direction, principles) mocked up and waiting for the maintainer.** Updated after every round. Decided items are facts; open items are a list. Implementation prompt: [`IMPLEMENTATION-PROMPT.md`](IMPLEMENTATION-PROMPT.md) (written in round 8). Mockups: [`mockups/`](mockups/). Round reports: [`ROUND-1-DIAGNOSIS.md`](ROUND-1-DIAGNOSIS.md).

Guiding idea (from the brief): pleasant and easy to use every day, calm, clear, easy on the eyes, not overloaded.

## 0. Decided in round 1 (maintainer's answers, 2026-10-01)
- **Main use: desktop, mouse-heavy.** Click paths and visible controls count more than shortcuts; keyboard stays a bonus. Phone is secondary but must not break (P1).
- **Dark theme first.** Mockups and token work start dark; light is derived and checked, not the other way round.
- **Must keep:** free-text quick capture (FAB → sentence → local parser), movable home widgets (order, size, hide, synced), a sidebar that shows every active module (no icon-only rail as the default), Nemo orange and the fish.
- **All four pains confirmed:** home does not show "today" (P3), flat navigation and rigid bottom nav (P5), tall cards and phone wrapping (P1, P8, P9), accent doubling and the FAB everywhere (P2).
- **New input:** "I sometimes have to search a lot – maybe modules can be combined." → round 3 brings a proposal for grouping and merging modules in the navigation (information architecture), without changing module code boundaries.

## 1. Principles
- Proposed in round 2 (see `ROUND-2-DIRECTION.md`): Heute zuerst · Eine Hauptaktion pro Ansicht · Daten vor Dekoration · Zeilen statt Karten · Gleiches sieht gleich aus · Bewegung nur als Rückmeldung · Ruhe durch Weglassen. **Not decided yet.**
- Direction candidates: A "Ruhig und luftig", B "Dicht und effizient", C "Weich mit Tiefe" (`mockups/round-2/`). **Not decided yet.**

## 2. Layout (desktop / phone)
- Facts today: sidebar 248 px from 900 px, bottom nav 5 slots (Home + 3 modules + Mehr) below; page widths narrow 45 rem / content 70 rem / wide 100 rem / full; split views from 1500 px viewport.
- open (round 3)

## 3. Navigation and module order
- Facts today: flat manifest order, not configurable; bottom nav takes the first three modules.
- open (round 3)

## 4. Home screen
- Facts today: widget grid 1/2/3/4 columns at 44/70/95 rem container width, sizes s/m/l, edit mode, synced layout.
- open (round 3)

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
