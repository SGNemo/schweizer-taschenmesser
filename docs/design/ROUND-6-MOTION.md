# Design evaluation – round 6: motion (2026-10-01)

Demo: [`mockups/round-6/motion.html`](mockups/round-6/motion.html) – open in a browser, press "Abspielen"; the checkbox simulates `prefers-reduced-motion`. Frames (`motion--*-0-before`, `-1-110ms`, `-2-220ms`, `-3-after`, `-reduced.png`) were captured with the durations slowed ×10, so what you see at "110 ms" is the real 110 ms state.

## Principles (principle 6: "Bewegung nur als Rückmeldung")
- **Three durations:** fast 120 ms (press, colour of a 24 px control, crossfade), normal 200 ms (open, tick, indicator), slow 250 ms (sheet, row leaves, bars). Nothing longer; closing in half the time. Easing `cubic-bezier(.22,1,.36,1)` (ease-out) for everything that enters, `cubic-bezier(.2,0,0,1)` for state changes, linear only for opacity crossfades.
- **Only `transform` and `opacity`** (plus `background`/`border-color` on controls ≤ 44 px). Never width, height, colour of surfaces, box-shadow, filter/blur. Progress bars `scaleX`, bars `scaleY`, rows `translateX/Y`.
- **Motion answers an action.** Tick, save, open, close, sort, delete: yes. Navigation, first render of a list, hover backgrounds, data updates in charts, numbers: no.
- **One endless loop only:** the skeleton shimmer (background-position, cheap). The sync icon stops spinning; a dot pulses once when a sync ends.
- **Reduced motion:** `--dur-* = 0` → every state change is instant; shimmer static; stagger delays reset to 0 (fixes the review finding where items stayed invisible for 150 ms). No "we animate anyway but shorter".

## The six examples
| # | What | How | Reduced motion |
|---|---|---|---|
| 1 | Tick a ToDo / mark paid | box fills (120), check scales 0→1 (200), title greys + strike; after 600 ms the row slides 16 px right and fades (250), the next row moves up (250) | states jump, row disappears |
| 2 | Save + toast | button scale .97 (120); toast from +24 px to 0 with fade (250), stays 6 s, Rückgängig inside | toast appears |
| 3 | Dialog / sheet | backdrop fades to 55 % (200); dialog scale .96→1 + fade (200); phone sheet translateY 100 %→0 (250); close = half | instant |
| 4 | Tabs / pages | **no page slide or fade**: tab indicator translateX (200), content crossfade 120 ms linear; area change = same crossfade | instant |
| 5 | Loading | skeleton shimmer 1.4 s; content fades over it (200) | shimmer static, content instant |
| 6 | Charts | bars scaleY from bottom (250) with 30 ms stagger, total < 450 ms; only on first appearance, never on data change | bars stand |

Also: hover = background change without transition; press = scale .97 on buttons and FAB; drag = lifted item gets level-2 shadow and scale 1.02 (dnd-kit overlay), drop = 200 ms settle; home widget hide = fade + collapse via `transform` (not height); notification badge = scale pop 200 ms once.

## Removed from today
`pageIn` (fade + 6 px slide on every route and tab change), the `itemIn` list stagger, `pillIn` on the bottom nav, the endless sync spin, backdrop blur on dialogs, width/colour/shadow transitions (review M8 motion findings).

## Questions for round 6 (asked in chat)
1. Accept the six patterns and the "not animated" list?
2. Page/area switch: 120 ms crossfade (proposed) or truly none?
3. Tick: row leaves the list after 600 ms (proposed) or stays until the view is reopened (less motion, "erledigt" stays visible)?
