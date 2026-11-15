# Planner hub – accessibility review of direction A (chat E)

**Standard:** WCAG 2.1 AA · **Date:** 2026-11-15 · skill `design:accessibility-review` · object: `mockups/direction-a.html` (+ `?state=`, `?sheet=1`; removed with the round, in the git history) at 1920 × 1080 and 412 × 915, light and dark. Part of [CONCEPT-DESIGN](CONCEPT-DESIGN.md). A mockup review: colours are computed from the values of `web/src/ui/tokens.css`, sizes and order are read from the rendered DOM; nothing was tested with a screen reader. The build repeats this with NVDA / TalkBack.

## Summary

**Issues found:** 10 · **Critical:** 0 · **Major:** 3 · **Minor:** 7. Text contrast passes everywhere in both themes; the three major points are non-text contrast of two new parts and the order inside a row.

## Findings

### Perceivable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 1 | The plate of a lead action (`--surface-2` on the card) is 1.2 : 1 light and 1.0 : 1 dark: the button's edge was invisible | 1.4.11 | Major – **fixed in the mockup** | outline `--border-strong` like the tick (3.9 / 3.5 : 1); the glyph itself is 14.1 / 13.4 : 1 |
| 2 | Bar track on the card 1.2 : 1; the mockup's 70 % outline reaches only 2.6 / 2.2 : 1. The track length carries the day's capacity | 1.4.11 | Major | outline in full `--border-strong`; the value stands as text beside every bar („37 Min frei von 3 h 12“), on the tile only the free time – add the capacity to the tile's name |
| 3 | A fixed block differs from the card by 1.2 : 1 | 1.4.1 | Minor | not colour alone: clock in the lead slot, „Termin“ / „Training“ and the time stand in the row – keep all three |
| 4 | Titles are cut with an ellipsis on the desktop (`nowrap`) | 1.4.4 / 1.4.10 | Minor | wrap to two lines as on the phone; with „Sehr groß“ (20 px root) the band falls back to the phone tile below 900 CSS px |
| 5 | The hatched „over“ bar is pattern and words („40 Min mehr als planbar“), never red | 1.4.1 | passes | keep the sentence |

### Operable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 6 | Inside a row the DOM order is lead → ⋯ → chips, the visual order lead → chips → ⋯ | 2.4.3 | Major | chips before the menu in the DOM, placed by grid rows |
| 7 | The late group is stop 50–61 of 62 on the desktop (after the whole day) | 2.4.1 | Minor | it is an `aside` with a name and the group an `h2`; add it to the page's skip links („Zu ‚Frist vorbei‘“) |
| 8 | Swipe changes the day on the phone | 2.5.1 | passes | the seven tiles do the same with a tap; „Verschieben …“ replaces any drag |
| 9 | Targets: 0 of 47 (desktop) and 0 of 26 (phone) page controls under 44 × 44; tick 24 px drawn in a 44-px button; chips 28 px drawn in a 44-px link | 2.5.5 | passes | shell only: sidebar rows 36 px (house rule for fine pointers), the mockup's logo placeholder 33 px |

### Understandable

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 10 | The lead action is a glyph without visible words | 3.2.4 / 3.3.2 | Minor | name and tooltip „Bezahlt …“, the same words as first ⋯ entry; check in the first use (CONCEPT-DESIGN §11) |
| 11 | Example chips look like filters | 3.2.2 | Minor | a chip only fills the field and moves focus there; it never submits |
| 12 | A failed entry had no message (design-system audit) | 3.3.1 | Minor | text under the field, `aria-live="polite"` (CONCEPT-COPY „Field error“) |

### Robust

| # | Issue | WCAG | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| 13 | Mockup shortcuts: the field is a `div role="textbox"`, „Zuerst“ / „Danach“ are presentational list items | 4.1.2 / 1.3.1 | Minor (mockup) | build: `TextField` with its label; two lists, each named by an `h3`; fold buttons with `aria-expanded` and `aria-controls` |
| 14 | Day tiles are toggle buttons | 4.1.2 | passes | `aria-pressed` for the picked day, `aria-current="date"` for today, group name „Woche“ |

## Colour contrast (computed)

| Element | Light | Ratio | Dark | Ratio | Required | Pass |
| --- | --- | --- | --- | --- | --- | --- |
| Row title 16/500 | #171f24 on #ffffff | 16.7 | #eceff1 on #1b2126 | 14.1 | 4.5 | yes |
| Row meta 13 | #5f6c75 on #ffffff | 5.4 | #88939b on #1b2126 | 5.2 | 4.5 | yes |
| Source word, duration | #55636b on #ffffff | 6.2 | #aab4bb on #1b2126 | 7.7 | 4.5 | yes |
| Meta on a block row | #5f6c75 on #e9ecee | 4.6 | #88939b on #0c0f12 | 6.1 | 4.5 | yes (tight) |
| Source word on a block row | #55636b on #e9ecee | 5.2 | #aab4bb on #0c0f12 | 9.1 | 4.5 | yes |
| Chip text | #171f24 on #eaecee | 14.1 | #eceff1 on #1f2529 | 13.4 | 4.5 | yes |
| „Zum Beispiel“, hints on the page | #5f6c75 on #f3f4f4 | 4.9 | #88939b on #0f1316 | 5.9 | 4.5 | yes |
| Head context line | #55636b on #f3f4f4 | 5.6 | #aab4bb on #0f1316 | 8.8 | 4.5 | yes |
| Meta in the picked tile | #5f6c75 on #eaecee | 4.6 | #88939b on #1f2529 | 4.9 | 4.5 | yes (tight) |
| „Frist vorbei“ icon | #b3261e on #ffffff | 6.5 | #f4a39c on #1b2126 | 8.2 | 3 | yes |
| Button „Eintragen“ | #ffffff on #b5430c | 5.6 | #1b0f06 on #ff9a57 | 9.0 | 4.5 | yes |
| Tick outline, action outline | #76838c on #ffffff | 3.9 | #6b767e on #1b2126 | 3.5 | 3 | yes |
| Field outline | #76838c on #f3f4f4 | 3.5 | #6b767e on #0f1316 | 4.0 | 3 | yes |
| Bar fill on its track | #733b8f on #e9ecee | 6.4 | #cd9ae7 on #0c0f12 | 8.6 | 3 | yes |
| Bar track on the card | #e9ecee on #ffffff | 1.2 | #0c0f12 on #1b2126 | 1.2 | 3 | **no** → finding 2 |
| Picked tile outline | #171f24 on #ffffff | 16.7 | #eceff1 on #1b2126 | 14.1 | 3 | yes |
| Focus ring on card / page | #963709 | 7.4 / 6.7 | #ffb07a | 9.1 / 10.4 | 3 | yes |
| Sidebar current item | #171f24 on #e9e0ed | 13.0 | #eceff1 on #373445 | 10.5 | 4.5 | yes |

## Keyboard

| Stop (desktop, 62 in all) | Order | Enter / Space | Escape | Arrows |
| --- | --- | --- | --- | --- |
| Sidebar, top bar, head menu, gear | 1–13 | open | closes the menu | – |
| Field (focused on arrival, `data-autofocus`) | 14 | Enter = „Eintragen“ (preview first for sentences) | „Verwerfen“ of the preview | – |
| „Eintragen“, three example chips | 15–18 | chip fills the field, focus returns to it | – | – |
| Seven day tiles | 19–25 | picks the day; focus stays on the tile | – | recommended: one tab stop, ←/→ move (roving) |
| Day sheet: „Warum?“, then per row lead → chips → ⋯ | 26–47 | tick: done + undo toast (focus to the next row's lead); action: route into the source | closes ⋯ | – |
| „Rest verteilen“, „Tage einteilen“ | 48–49 | preview / dialog | closes | – |
| „Frist vorbei“ rows, waiting group | 50–62 | as rows | – | – |

Phone (33 stops): top bar → module row → tiles → „Frist vorbei“ → day → waiting group → bottom bar with the plus („Ding eintragen“). The capture sheet is a dialog: focus moves into the field, is trapped, Escape and the scrim close it, focus returns to the plus.

## Screen reader names

| Element | Announced as |
| --- | --- |
| Head | „Planer“, heading 1; figure and context as one text: „37 Min frei, morgen, Mo. 16., heute ist frei“ |
| Tile | „Morgen, Montag, 16. November: 37 Min frei · 9 Dinge“, toggle button, pressed |
| Day sheet | region „Morgen · Montag, 16. November“; bar: image „37 Min frei“ |
| ToDo row | list item; „Erledigt: Steuerunterlagen sortieren“, button · „Steuerunterlagen sortieren, ToDo, Frist Do, 35 Min“ · „Aktionen für Steuerunterlagen sortieren“, menu button |
| Invoice row | „Bezahlt …: Stadtwerke Musterstadt, 92,40 € bis 20.11.“, button · text „Rechnung, Mahnung · 92,40 € bis 20.11., 10 Min“ · links „Zur Mahnung“, „Zur Rechnung“ in a group „Verknüpft“ |
| Shopping row | „Zur Liste: Einkaufen · 7 Dinge“, button |
| Block | „Teamrunde, Termin, 09:30–10:30, 1 h“ – no control; training: „Erledigt: Training · Oberkörper“ + „18:00–19:00, fest“ |
| Late group | region „Frist vorbei, 6 Rechnungen, 573,59 €“; the icon is decorative, the words carry it |
| Folds | „Danach · 5 Dinge, 1 h 20“, button, collapsed |
| Separators „·“ | hidden (`aria-hidden`) |

## Motion

No motion carries meaning. Day change and the capture sheet move by transform / opacity only; under `prefers-reduced-motion` and the app's `data-motion='reduce'` they switch without a slide. A ticked row fades, the list closes without a jump, focus goes to the next row. Nothing counts, blinks or loops.

## Priority fixes for the build

1. **Outline on every new control and track** (findings 1, 2) – low-vision users cannot find the action slot or read the capacity otherwise.
2. **DOM order of a row = visual order** (6) – keyboard and switch users.
3. **Skip link and heading for „Frist vorbei“** (7), **roving focus in the band**, **titles that wrap** (4).
