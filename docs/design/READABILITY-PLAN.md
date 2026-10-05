# Readability – plan (Phase 1, awaiting approval)

Branch `feat/readability`. Before screenshots (1920×1080, 412×915, light/dark, seed `medium`): `screenshots/readability/before-*`. Mockups: `mockups/readability/` (`overview-a`, `overview-b`, `list`, each `--light/--dark.png`).

## Findings (state today)
- Much exists: `dueState()` (`core/time/due.ts`), `StateBadge`, `Badge`, text size (`data-text-size`), leading (`data-leading`), density, motion (`stores/ui.ts`, localStorage `tm-*`, `AppearanceSection.tsx`). No `Text`/`Divider`/`Table`/grouped-list component; no `Intl.Segmenter` use.
- Invoices (`InvoicesPage`): flat card grid, overdue as red text only, no groups. Calendar week: accent-tinted blocks for most events (colour without meaning), all hours equal lines, no weekend tint. Dashboard: accent used for links/underlines (`Home.module.css` `.linkButton`, `NextWidget.module.css`).
- No "Nachrichten" module exists: teaser targets are Notes excerpt, Lists, bookmarks description, AI answers (`AnswerView`), `HelpHint`/`SettingRow`, setup texts.
- No virtualized list exists; long lists are plain DOM → memoised per-string processing is enough.

## 1. Reading aid (`ReadableText`, `core/text/readable.ts`)
- Pure `emphasize(text, {share, minLen}) → segments[{text, strong}]`: split by `Intl.Segmenter` (word + grapheme, so no cut inside umlauts/ligatures); words < `minLen` (default 4) untouched; tokens with digits, `€`, dates, times, codes, URLs, e-mails excluded; compounds: strong part = share of the first word part, capped at 6 graphemes. LRU memo (500 entries).
- Rendering: `<span>` runs, strong = `font-weight` via Inter Variable (e.g. 400 → 600, no width change problems: Inter variable keeps layout shift ≈ 1–2 %; **a `font-variation` + `letter-spacing` correction is measured in e2e, "no layout jump" = same line count and row height**). Optional "soft" mode: weight 500 + `--text` vs rest `--text-muted` (small contrast difference instead of pure bold). Segments get `aria-hidden`-free plain text: the visible text is one string, strong spans are `<span>` without semantics (never `<b>/<strong>`) so screen readers read one flow.
- Settings (Einstellungen → Darstellung → "Lesen", device-local like the other appearance settings): on/off (**default off**), share 30/40/50, style bold|soft, scope "nur Fließtext" | "auch Listen". Shortcut `Alt+L` toggles; single suggestion in setup and one-time hint (device-local flag).
- Used in: ItemRow title/meta (scope lists), notes excerpt + editor preview, lists items, bookmark descriptions, `AnswerView`, `HelpHint`/`SettingRow` descriptions, setup texts. **Not** in inputs, numbers, code, buttons, navigation, `modules/vault` and `modules/accounts` (nothing there), enforced by a test that `ReadableText` is not imported there.

## 2. Colour semantics (tokens in `tokens.css`, aliases of existing colours; tests: every tone has icon+label)
| Meaning | Token | Pair (never colour alone) | Used for |
|---|---|---|---|
| overdue / error / exceeded | `--danger` | alert icon + "seit 3 Tagen" | left stripe, badge, date |
| today / urgent | `--accent` | clock icon + "Heute" | stripe, badge |
| soon (≤ 3 d) | neutral (`--text-muted`) | "in 2 Tagen" | text only |
| done | `--text-3` + strike | check icon | row |
| inactive / paused | `--text-3` | label "pausiert" | row |
| income / expense | `--success` / `--danger` | sign (+/−) | amounts only |
| status connected / locked | `--success` / `--warning` | icon + word | StateBadge |
| category 1…6 | new `--cat-1…6` (AA on surface in both themes) | chip dot **+ name** | chips, assignable per module |
Rules: titles, body, icons stay neutral; no accent underlines for plain links (accent only for the primary action, active nav, "today"); calendar blocks neutral with a left stripe in the calendar's category colour; tint only for "Jetzt wichtig". **Ruhig mode** (Darstellung): category colours and soon/done tones off, only overdue + today remain.

## 3. Structure rules (written into DESIGN-SPEC §4b/§7b, implemented in base components)
Group by spacing first; hairline only between different groups; group header 13 px `--text-3` + count, collapsible; card head = title left, key figure right; zebra only in dense tables; prose max `68ch` (`--measure`); numbers right-aligned, tabular, unit muted. New: `GroupedList` (+ `groupBy` logic in `core/time/groups.ts`: Überfällig/Heute/Morgen/Diese Woche/Später; Überfällig/Fällig/Bezahlt), `Divider`, `Text`/`Prose`. Default grouping in Rechnungen, ToDos, Erinnerungen, Abos; collapse state device-local. Calendar week: hour lines graded (full hour stronger, half hour faint), now line, day separators, weekend tint. Settings: section sub-headings + spacing via `SettingsGroup`.

## 4. Typography
Settings: font size small/normal/large (existing `textSize` gets "klein"), line spacing compact/normal/airy (existing `leading` + compact); default `leading` slightly airier (1.5 → 1.6, measured). Max 3 sizes per view, one title weight (600), `--text-3` re-checked on dark (≥ 4.5:1, test exists). Paragraph spacing instead of blank lines, hanging indent in list items. "Fokus-Lesen": reader mode for note view (wide column hidden chrome, aid on), phase-4 stretch, off by default.

## 5. Quality
Unit: `emphasize` (boundaries, umlauts, digits, share, truncation-safe), tone→icon+label mapping, grouping logic, token contrast for `--cat-*`. E2E: toggle without layout jump, settings apply immediately, grouping in Rechnungen/ToDos, phone viewport, axe light/dark. Perf: memo + `perf` spot check with seed `large`.

## Phases
2 tokens/base components/settings · 3 `ReadableText` + places · 4 views · 5 tests/axe/screenshots/docs/merge `develop` · 6 push + PR.
