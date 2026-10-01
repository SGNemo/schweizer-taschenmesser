# Design evaluation – round 5: components and interaction (2026-10-01)

Mockups: [`mockups/round-5/`](mockups/round-5/) – `components.html` (sheet, dark/light), `form-rechnung.html` (desktop dialog), `form-rechnung-phone.html` (bottom sheet), `quickadd.html` (free-text capture with parsed chips). Renders next to them. Tokens = round 4 (cool).

## 1. Base components (one of each, for every module)
| Component | Rule |
|---|---|
| **Button** | primary (filled accent, once per view: page head or dialog foot) · secondary (1 px `--border-strong`) · quiet (text only: Abbrechen, side paths) · danger (text in `--danger`; filled red only inside the confirm dialog) · row button 28–32 px with a 44 px hit area · icon button 40 px square, 12 px radius, chip background. Disabled = 45 % opacity, never hidden. |
| **Input** | label above (never placeholder-as-label), 44 px, 12 px radius, 1 px `--border-strong`, focus = 2 px `--focus` ring + 2 px offset. Error = red border + sentence under the field; hint = 13 px tertiary. Date fields show a human hint ("Montag, in 6 Tagen"). Search fields carry the icon and live in the page head, not in a card. |
| **Switch / checkbox / segmented / chips** | switch 44×26 (accent when on) · checkbox 24 px, 7 px radius, accent fill when on · segmented 38 px tall pill track in `--surface-2`, active = card colour + accent text · chips 32 px, active = `--accent-soft`. All hit areas ≥ 44 px. **Removes the four module-level copies of Segmented, the three progress bars and the hand-rolled inputs.** |
| **Tabs** | underline tabs for sub-views (areas, finance tabs); segmented only for filters inside a list. |
| **Card** | groups only; 16 px radius, level-1 shadow, no border; padding 22–24; title 15/600; optional hero number. |
| **Row (ItemRow)** | 44 px (phone 48), hairline between rows, 10 px radius on hover/selected; left: checkbox or icon; main: title + 13 px meta (one line on desktop, two on narrow); right: tabular amount/date, then row actions that appear on hover/focus (desktop) or via swipe (phone). Selected = `--accent-soft`, done = `--text-3` + strike. |
| **Table** | only where columns matter (Finanzen Buchungen, Zeiterfassung): caps header, hairlines, amounts right-aligned tabular, green for income. Everything else is rows. |
| **Dialog / sheet** | desktop: centred dialog 34 rem (forms) / 40 rem (quick capture), 20 px radius, level-2 shadow, backdrop 55 % black without blur. Phone: **bottom sheet** with grab handle, 88 vh max, keyboard-safe. Esc / backdrop / swipe-down closes with a draft kept for 30 s ("Entwurf verwerfen?" only if fields were filled). Setup assistant keeps the full-screen variant. |
| **Toast** | bottom centre, level-2, icon + sentence + **Rückgängig**, 6 s, stacks max 2; every destructive or state-changing action (bezahlt, erledigt, gelöscht, verschoben) gets one. |
| **Badge** | status only: Termin (accent soft), Erinnerung (chip), überfällig (danger 15 %), bezahlt (success 15 %), läuft ab (warning 15 %), Beta/Info (info 15 %). Never as decoration or category colour. |
| **States** | loading = `Skeleton` (3 bars, shimmer, respects reduced motion) – never "…" or spinners · empty = fish 56–64 px at 35 %, one sentence, one button · error = inline box with icon, sentence, retry button; sync errors in the shell banner, not toasts. |

## 2. Forms: quick capture vs. full form
- **"+ Neu" / `N` / FAB → quick capture** (desktop dialog 40 rem, phone sheet): one text field, parsed locally into chips (type, amount, date, recurrence, account default). `Tab` cycles the type, `Enter` creates, `Ctrl+Enter` opens the full form pre-filled. Inside a module the module's type is pre-selected (Rechnungen → Rechnung).
- **Full form** (dialog / sheet): required fields first (Empfänger, Betrag, Fällig), optional fields folded behind "Mehr" chips (Wiederholung, Erinnerung, Notiz, Kategorie …) that expand inline; footer: Abbrechen · Speichern und neu · **Speichern**. First field auto-focused (`data-autofocus`). Validation on blur and on submit, message under the field, focus moves to the first error.
- **Inline add** stays where it is fast today (ToDos, Einkauf, Packlisten): one row at the top of the list, Enter adds, field keeps focus.

## 3. Interaction concept
- **Keyboard (desktop):** `Ctrl+K` search/ask · `N` new · `G` then `H/P/G/A/W/T` go to area (Heute, Planen, Geld, hAushalt, Wissen, Tresor) · `J/K` or arrows select row · `Enter` open, `E` edit, `Space` tick · `Ctrl+Z` undo (also after the toast closed, last 10 actions) · `?` shortcut sheet · `Esc` close/clear selection · `/` focus list search. Single-letter keys never fire inside inputs.
- **Palette** gets "Neu: ToDo / Termin / …" commands and the area pages; it stays the one place for everything.
- **Mouse:** row actions on hover; drag-and-drop for ToDo order, home widgets, shopping list (existing dnd-kit); right-click = same menu as the "…" button.
- **Multi-select:** checkbox on a row enters selection mode (Shift-click ranges); bulk bar at the top: Erledigt · Verschieben · Löschen · Abbrechen.
- **Touch:** swipe right = done/paid (green, 72 px reveal, haptic tick), swipe left = move/snooze; long press = multi-select; pull-to-refresh only where sync is on.
- **Undo everywhere:** every write through `createRepo` is undoable via the toast and `Ctrl+Z`; deletes are soft (tombstones exist) with a 30-day "Papierkorb" page under Einstellungen (ROADMAP K4).
- **Focus:** visible 2 px ring on every interactive element; focus moves to `main` on navigation (kept), into dialogs on open and back to the opener on close.
- **Reduced motion:** every animation off (durations 0), skeleton shimmer static, swipe still works.
- **Text size:** setting "Normal / Groß" (16 / 18 px root); everything is rem-based. "Dichte: Kompakt" (rows 36 px, gaps 16) as an optional second setting for 1080p laptops.

## 4. Questions for round 5 (asked in chat)
1. Component sheet and rules: accept, or changes (e.g. keep cards with borders in light)?
2. Quick capture as the default "Neu" everywhere (full form one step away), or module pages open the full form directly?
3. Keyboard scheme: accept `N`, `G`+letter, `J/K`, `?`; or keep it to `Ctrl+K` only?
4. Settings "Textgröße" and "Dichte": both, text size only, or neither?
