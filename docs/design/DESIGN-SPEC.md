# Nemo design specification (working document)

Status: **round 1 (diagnosis) done, nothing decided yet.** Updated after every round. Decided items are facts; open items are a list. Implementation prompt: [`IMPLEMENTATION-PROMPT.md`](IMPLEMENTATION-PROMPT.md) (written in round 8). Mockups: [`mockups/`](mockups/). Round reports: [`ROUND-1-DIAGNOSIS.md`](ROUND-1-DIAGNOSIS.md).

Guiding idea (from the brief): pleasant and easy to use every day, calm, clear, easy on the eyes, not overloaded.

## 1. Principles
- open (round 2)

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
