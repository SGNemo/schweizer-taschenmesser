# Design evaluation – round 2: direction and principles (2026-10-01)

Three directions for the same home screen (desktop 1920 and phone 412, dark first, light derived), as standalone HTML in [`mockups/round-2/`](mockups/round-2/) (open in a browser, bottom-right link toggles the theme; `?theme=light`) and as PNG next to them. All three share the round-1 fixes that are not a matter of taste: one primary action "+ Neu" in the top bar on desktop (FAB only on the phone), greeting + date + summary strip, every widget with a hero number, "Heute" as the only large widget, lists as rows instead of cards, two-line rows in narrow widgets so nothing truncates or wraps mid-word, bottom nav with Finanzen instead of Erinnerungen.

## The three directions
| | A "Ruhig und luftig" | B "Dicht und effizient" | C "Weich mit Tiefe" |
|---|---|---|---|
| Idea | air and few lines; the eye rests | everything above the fold; the eye scans | layered, warm, a bit of glow |
| Page / surfaces | neutral near-black (#101417) page, cards one step lighter, **no borders, no shadows** | navy page, cards with 1 px borders and hairline dividers | ocean gradient page, translucent layered cards with soft shadow, glass top bar |
| Type | 16 px, h1 36 px / 600, hero 32 px | 14 px, h1 24 px / 700, hero 24 px, widget titles small caps | 16 px, h1 32 px / 700, hero 30 px with a light gradient |
| Density | 44 px rows, 28 px gaps, 24 px card padding | 32 px rows, 12 px gaps, 14 px padding, 4 columns | 42 px rows, 20 px gaps, 20 px padding |
| Radii / icons | 18 px / 1.5 px thin strokes | 10 px / 1.75 px | 20 px / 2 px rounded |
| Accent | orange, flat; badges as plain muted text | orange, flat; small caps pills | orange→coral gradient on the primary action, tinted pills |
| Gradients | none | none | page background, primary button, sparkline |
| Light theme | warm off-white, white cards without borders | cool light grey, bordered white cards | pale ocean tint, white cards with soft shadow |
| Fits best | calm daily companion; reading | power use, 1920+ screens, many modules | "nice to open"; phone |
| Risks | needs discipline, can look empty on 2560 | can feel like a tool; small type on 2560 | contrast and performance (blur, gradients) must be guarded; easy to overdo |

Honest assessment: **A or B for the shell and lists; C's warmth can be added later as a token layer** (gradient page, soft shadow) without changing structure. A mix "B density with A surfaces" is possible and I would show it next if you want it. Dark first favours A (surfaces carry the structure) over B (borders carry it).

## Proposed principles (pick, strike, add)
1. **Heute zuerst.** The home screen answers "what needs me today" without scrolling: date, counts, the day list, due money.
2. **Eine Hauptaktion pro Ansicht.** One filled accent per screen; everything else uses accent as text/icon colour. FAB only on the phone.
3. **Daten vor Dekoration.** Names, numbers and dates carry the hierarchy. No badge, colour or icon that does not help a decision.
4. **Zeilen statt Karten.** Entries are rows (one line of facts, two on narrow widths); cards only group. Density follows content, not the module.
5. **Gleiches sieht gleich aus.** One list row, one segmented control, one page head, one empty state, one dialog/sheet pattern for all modules.
6. **Bewegung nur als Rückmeldung.** Motion confirms what the user did (tick, save, open); navigation does not animate.
7. **Ruhe durch Weglassen.** Fewer borders and labels, generous edges, tight centres; dark is the reference theme, light is derived and checked for AA.

## Questions for round 2 (asked in chat)
1. Direction: A, B, C, or a named mix (e.g. "B with A's surfaces")?
2. Principles: accept 1–7, strike some, add yours?
3. Accent: keep Nemo orange as the only accent, keep orange + teal as secondary, or something else?
4. Gradients: none, brand only (splash/empty states as today), subtle page background, or also on cards/buttons?
