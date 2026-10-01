# Design evaluation – round 4: colour, typography, surfaces (2026-10-01)

Mockups: [`mockups/round-4/`](mockups/round-4/) – `tokens.html` (token sheet), `home.html`, `rechnungen.html`; all take `?theme=dark|light&palette=cool|warm|graphite`. Renders next to them. Every value below passed a WCAG check (`contrast.py` in the session; the numbers are also printed on the token sheet): text ≥ 4.5:1 on page, card and chip surfaces; borders, focus ring and chart colours ≥ 3:1.

## 1. Palette – three neutral bases for the decided direction D
The orange, the status colours and the structure are identical; only the **neutral base** differs. The difference is small on purpose (see `palette-compare-dark.png`): it decides whether the app feels slightly cool, slightly warm or pure grey next to the orange.

| | cool (recommended) | warm | graphite |
|---|---|---|---|
| Dark page / card / chip | `#0f1316` / `#171c20` / `#1f2529` | `#141210` / `#1c1a17` / `#242220` | `#111111` / `#191919` / `#212121` |
| Dark text / 2 / 3 | `#eceff1` / `#aab4bb` / `#88939b` | `#f0ede8` / `#b3ada4` / `#948e85` | `#eeeeee` / `#ababab` / `#8c8c8c` |
| Light page / card / chip | `#f3f4f4` / `#ffffff` / `#eaecee` | `#f5f3ef` / `#ffffff` / `#ece9e3` | `#f4f4f4` / `#ffffff` / `#ebebeb` |
| Light text / 2 / 3 | `#171f24` / `#55636b` / `#5f6c75` | `#1d1a16` / `#5c5852` / `#6a665f` | `#1a1a1a` / `#595959` / `#686868` |
| Character | orange pops, stays calm; closest to A | cosy, orange and base blend (less contrast between accent and page) | neutral, technical |

Why cool: orange is a warm accent, a slightly cool neutral gives it room without the blue cast of today's navy; warm makes orange look brownish on buttons; graphite is fine but characterless.

## 2. Shared tokens (all palettes)
| Token | Dark | Light | Use |
|---|---|---|---|
| `--accent` | `#ff9a57` | `#b5430c` | primary action, active nav, links, "Termin" |
| `--accent-contrast` | `#1b0f06` | `#ffffff` | text on the filled accent |
| `--accent-soft` | `#2e241c` (cool) | `#fbe9de` | active nav background, selected row, "Termin" chip |
| `--danger` / `--success` / `--warning` / `--info` | `#f4a39c` / `#7fd3a3` / `#e8b85a` / `#7cc7e8` | `#b3261e` / `#1b7545` / `#8a5a00` / `#1f5fa8` | status text; soft backgrounds = `color-mix(status 15%, transparent)` |
| `--viz-1` / `--viz-2` | `#4fb3ad` / `#ff9a57` | `#16847f` / `#c94f12` | two chart series; further series grey (`--border-strong`) |
| `--focus` | `#ffb07a` | `#0b6f72` | 2 px outline, 2 px offset (ring replaces today's 3 px blur) |
| `--border` | per palette | per palette | hairline row dividers only |
| `--border-strong` | per palette (≥ 3:1 on chip) | per palette | input and secondary-button borders |
| Teal `--accent-2` | dropped as UI colour | | lives on as `--viz-1`; focus ring in light stays teal for AA |

Accent variants (teal, coral, lagoon) stay available in settings as today; they replace only `--accent*`.

## 3. Depth (no gradients)
| Level | What | Dark | Light |
|---|---|---|---|
| 0 page | solid `--bg` | – | – |
| 1 card / widget / list | `--surface`, no border, soft shadow | `0 1px 0 rgb(255 255 255 / .04) inset, 0 8px 24px rgb(0 0 0 / .35), 0 1px 2px rgb(0 0 0 / .3)` | `0 1px 2px rgb(23 31 36 / .06), 0 8px 24px rgb(23 31 36 / .07)` |
| 2 menu / dialog / sheet / FAB | `--surface` | `0 16px 48px rgb(0 0 0 / .45), 0 2px 6px rgb(0 0 0 / .3)` | `0 16px 48px rgb(23 31 36 / .18), 0 2px 6px rgb(23 31 36 / .08)` |
| top bar / bottom nav | `color-mix(--bg 85%, transparent)` + `backdrop-filter: blur(12px)`, 1 px `--border` | | |
- Gradients only for brand (splash, empty-state fish, store images). Rows inside a card: 1 px `--border`. Cards never carry a border.
- Radii: sm 8 (chips inside rows, kbd), md 12 (buttons, inputs, nav items), lg 16 (cards, widgets), xl 20 (dialogs, sheets), full (pills, FAB).
- Spacing: 4-px grid, scale 4 / 8 / 12 / 16 / 24 / 32 / 48; card padding 22–24, grid gap 24, row height 44 (phone 48), hairline 1.

## 4. Typography
- **Inter Variable** stays (local, OFL, already shipped; tabular figures, good at 13–16 px, variable weight). No second family. Monospace: system stack, only for tokens/keys.
- Scale: hero `clamp(2rem, 1.6rem + 1.2vw, 2.75rem)`/700/1.1 · h1 32/600/1.1 (phone 28) · h2 20/600/1.25 · body 16/400/1.5 · label 15/500 · meta 13/400 tertiary · caps 11/600/+6 % uppercase · `--text-xs` 12 only for badges.
- Headings: letter-spacing −0.02 em at ≥ 28 px. Numbers: `font-variant-numeric: tabular-nums` everywhere amounts, times and dates align (lists, tables, widgets).
- List hierarchy: row = title (16/400 `--text`) + meta (13 `--text-3`), amount right (16/600 tabular). Card = title (15/600) → hero (32/700) → sub (14 `--text-2`) → rows.
- Text size setting ("Normal / Groß" = 16 / 18 px root) is proposed for round 5; everything is rem-based so it costs nothing.

## 5. Icons and illustration
- One set: **Lucide** (already in use), 20 px, stroke 1.5 (today 2 → thinner for calm; 1.75 at 16 px). Rail icons 22 px. No filled variants, no emoji.
- Empty states: the fish mark at 64 px, 35 % opacity in `--text-3`, one sentence, one button. No module illustrations. Splash keeps the ocean gradient (brand).

## 6. Questions for round 4 (asked in chat)
1. Neutral base: cool, warm or graphite?
2. Inter stays as the only typeface, or do you want to see one alternative (would need a font file fetched and checked for licence)?
3. Teal as a UI colour is dropped (charts + light focus only) – agree?
4. Icon stroke 1.5 px (thinner than today) – agree?
