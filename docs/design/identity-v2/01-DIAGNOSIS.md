# Identity v2 – round 1: diagnosis (2026-11-03, branch `feat/module-shell-identity`)

Dev build, seed `medium`, 1920×1080 · 2560×1440 · 412×915, light and dark. Captured with
`npm run screenshots` (`capture.spec.ts`) plus the new `identity-dialogs.spec.ts` (weather, Spotify with mocked
APIs). Screenshots stay out of the repo (size); contact sheets were handed over in the chat.

## What every module looks like today

| Module | Mounted as | Use of space (1920 / 2560 / phone) | Head | Colour | Recognisable by |
|---|---|---|---|---|---|
| Übersicht | page | "Ruhig": widgets in one column ≈ 55 % of the width, right half empty; "Ausführlich" fills | h1 + Cockpit + Ruhig/Ausführlich + Anpassen | accent only; hue chips on widget heads | the logo, nothing else |
| Kalender | page `full` | fills (week grid + agenda column); phone list | eyebrow Planen + tabs + h1 + segment + toolbar | sky edge, today column tint | the time grid (strongest of all) |
| ToDos | page `wide` | list fills; phone fine | generic | moss edge | nothing |
| Karten & Orte | page `wide` (not captured: map tiles need network) | – | generic | ocean edge | the map itself |
| Personen | page `wide` | 4-column tile grid fills | generic + segment | plum edge | nothing |
| Finanzen | page `wide` | KPI row + two chart cards + Buchungen column; charts lazy ("…" in the first 600 ms) | h1 + segment + month | teal edge, green income | nothing (numbers only) |
| Rechnungen | page `wide` | list uses ≈ 2/3, right third empty (no detail panel) | h1 + "Offen gesamt" | ocean edge, red overdue chips | nothing |
| Abos | page `wide` | list fills | h1 + two stats | navy edge | the switches |
| Budgets | page `wide` | two small cards top-left, ≈ 80 % empty | h1 + segment + month | indigo edge, red "drüber" | nothing |
| Listen | page `content` | narrow column, rest empty (squeezed into 70 rem) | h1 + list chips | orchid edge | the checkboxes |
| Vorräte | page `content` | narrow column, grouped by place | h1 + filter chips | moss edge | nothing |
| Merkliste | page `wide` | list fills | h1 + segment + search | indigo edge | nothing |
| Notizen | page `full` | three columns (filters, list, editor) fill | own head ("+ Neue Seite", editor title) | violet edge | the editor (already app-like) |
| Chat · Browser | page `content` · `full` (not captured) | – | generic | sky · navy | – |
| E-Mail | page `content` | narrow column | h1 + folder + search | teal edge | nothing |
| Unterlagen (vault) | page `wide` | 4-column tiles fill | h1 + hint + filter chips | plum edge, orange "Abgelaufen" | nothing |
| Passwörter (accounts) | page `wide` | master–detail; empty detail "Zugang auswählen" | h1 + Sperren + four buttons | slate edge | the lock |
| Dieser PC (disk) | page `full` | drive cards + Schnellübersicht fill | h1 + segment + hint | slate edge, ring gauges | the ring gauges |
| Downloads | page `content` (not captured: no seed) | – | generic | navy | – |
| **Wetter** | **dialog `xl` over the Übersicht** (`home/WeatherPreview`) | fills the 76 rem dialog; phone: bottom sheet | dialog title "Bern" | green tinted hero card, green/amber rating chips | the hero card, weakly |
| **Spotify** | **dialog `xl` over the Übersicht** (`home/SpotifyPlayer`) | left nav 16 rem, **right pane empty** except one sentence; the bottom bar is the only content | dialog title "Spotify" | none (accent) | nothing |

Pattern: 18 of 20 pages share one head (eyebrow, h1, segmented control, toolbar) and differ only by a 4 px
edge and a chip. Three layout widths are used inconsistently (Listen and Vorräte are `content` and look squeezed
on 1920, Budgets is `wide` and looks empty). Weather and Spotify are not modules at all: no manifest, no identity, no
route, no area; they are features of the Übersicht that open a dialog.

## Weather and Spotify in detail

**Wetter** (`home/WeatherPreview.tsx`, 323 lines, dialog `xl`)
- Everything has the same weight: seven KPI pills of equal size (feels like, min/max, wind, gusts, humidity, sun,
  UV), then a chart, then hour rows and day rows that use the identical row component. Nothing says "this is what
  matters now".
- The chart is a third of the dialog wide and ≈ 150 px high; rain is a single blue bar, wind is not drawn, the
  night band is a grey rectangle without label.
- No weather feeling: one 40 px icon, a flat green tint; the same look for sun, rain and storm, day and night.
- Allergy/air quality is a peer card next to the hero, as loud as the current temperature.
- Phone: seven full-width KPI pills stacked before anything else; the chart needs scrolling.
- Only one place; warnings are not shown (the API offers them).

**Spotify** (`home/SpotifyPlayer.tsx`, dialog `xl`)
- The right pane is empty until something is clicked ("Wähle links eine Playlist …"); on 1920 that is
  ≈ 900 × 740 px of nothing. Playlists are plain text, no covers.
- No active device: the bar says "Gerade läuft nichts. Kein aktives Gerät. Starte Spotify einm…" (truncated), the
  device menu offers "Kein Gerät gefunden" as a dead entry; there is no button that opens Spotify, no visible device
  list, no hint that controlling needs Premium. The user has nothing to do.
- No cover in the bar (icon placeholder), no colour from the music; the dialog looks like a settings page.
- Phone: six links, then the empty sheet, then the bar.

## Findings outside the two modules
- Identity v1 (`docs/decisions/ui-shell.md`, 2026-11-02) decided "no tinted header bands, no per-module motifs".
  v2 reverses that on purpose; round 2 records a superseding decision.
- The "Ruhig" Übersicht leaves half of a 1920 screen empty; the widget column has a fixed width.
- Lazy charts (Finanzen) render as "…" for a moment; not a layout defect, but the first impression of the page.
