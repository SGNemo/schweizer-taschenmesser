# Comfort review – 02 Measures and packages

Basis: [01-friction.md](01-friction.md) (code-traced counts + screenshots in `screens/`) and the maintainer's answers (daily: to-dos, calendar/reminders, money; all four annoyances count). Docs only; nothing is built before approval.

**Rule of thumb for every measure:** it must make one concrete everyday action faster (see targets) – otherwise it is dropped. Basis shows what is needed daily, "Erweitert" holds the rest and is never the only place for something important. Every new text in all 5 languages (`check:i18n`).

## 1. Cross-cutting patterns (verdict from the measurement)

| Pattern | Verdict | Why (evidence) | Effort |
|---|---|---|---|
| **Undo everywhere** (`undoableWithToast` for delete, pause, counter, widget ticks) | **Do first** | Permanent deletes in 11 of 13 modules; widget tick without undo; invoice undo bypasses the journal | S |
| **Row-action contract** on `ItemRow`: primary tick, swipe right/left, hover buttons (touch: always visible), overflow menu (⋯, right-click, long-press), J/K/E/Space/Del | **Do** | Only `lists` has it; 7 of the worst actions are "change one thing in a row" | M |
| **Quick-shift chips** (`DateChips`: Heute · Morgen · Nächste Woche · Datum…; `+1 Tag/Std` for events) as a shared popover | **Do** | Move/push/snooze cost 5–9 taps today (actions 2, 4, 6, 8) | S–M |
| **Inline edit** only for what a chip/popover can do (date, priority, amount, category, status) – no free-text inline editing | **Do, narrow** | Full dialogs for single fields (8, 12, 14, 22) | M |
| **Minimal create**: title/amount first, "Mehr Felder" fold, last-used values (category/account per payee), Duplicate | **Do** | Always-visible rarely used fields; birthday defaults to today; no duplicate outside lists | M |
| **Quick Capture coverage**: invoice, birthday, pantry, note prefix `n`, finance without confirm when parse is certain | **Do, selected** | 7 of 14 modules lack a capture target; note needs a chip click | M |
| **"Jetzt" strip per module** (today / overdue / next, one line of numbers) | **Do, light** | Home already has "Jetzt wichtig"; modules mostly group already (todos, invoices). Only add where missing (calendar, finance, pantry) | S–M |
| **Filter chips instead of dropdowns**, saved views | Chips yes, **saved views no** | Chips are cheap; saved views have no evidence of need | S / L |
| **Global search lands on the record** + palette actions per module | **Do (package 4)** | Search hit opens the module list only (action 25) | M |
| **Links between modules** (invoice→todo/reminder, location→route, sub→bookings, chat answer→note, pantry→"alles nachkaufen") | **Do, selected** | Several are one-line actions with high value; the rest costs L | S–M each |
| **Multi-select with bulk actions** | **Only lists + todos + finished reminders** | No evidence of bulk need elsewhere | M |
| **Erweitert switch** (per module, header toggle + module setting, remembered, default Basis) | **Do** | 10+ rarely used fields/filters/tabs identified | M (one hook, then per-module S) |
| **Context menu / long-press** | Part of the row contract (⋯ + right-click + long-press) | Zero hits today | included |
| **Typed confirmation** | **Question to maintainer** (see §5) | Only device reset, recovery reset, disk delete use it | S |

Not recommended: saved views, split bookings (L, no daily use), recipe import (L), habit tracker (retired on purpose), per-module palette command tree beyond "Neu" + 3–4 verbs.

## 2. Contracts to build (Paket 1/3, reused by new modules)
- `ui/RowActions` (extends `ItemRow`): `actions: { primary?, swipeRight?, swipeLeft?, quick?: QuickAction[], menu?: MenuAction[] }`, every action returns an undoable result; keyboard map and a visible alternative for each swipe. `todos` `TaskRow` and calendar `ItemRow` are moved onto it.
- `core/undo`: `deleteWithUndo(repo, record, label)` helper; `check:modules` flags `repo.remove(` calls in module UIs that bypass it.
- `ui/DateChips` + `useQuickShift` (todo `dueDate`, event date/time, reminder snooze, invoice due).
- `core/comfort/advanced.ts` + `<AdvancedToggle moduleId>`: synced setting scope `comfort`, `{[moduleId]: 'basic'|'advanced'}`, default basic; module settings row via the settings registry. `manifest.comfort?: { advanced: true }` is a **hotspot** (`core/modules/types.ts`): own row in `CHATS.md` and merge first.
- `check:modules`: every module list screen uses the row-action contract or declares `comfort: { rows: 'none', why }`; new-module template/generator updated.
- Hotspots touched: `web/src/strings.ts` + 4 locale catalogs (append in module blocks only), `core/modules/types.ts`, `Settings` registry. Announce first in `docs/CHATS.md`.

## 3. Packages (one PR each, stop after each)

| # | Package | Content | Actions improved | Effort | Conflict risk (CHATS) |
|---|---|---|---|---|---|
| **1** | **Undo + row actions + quick-shift** | `deleteWithUndo` in all modules; `RowActions` + `DateChips`; apply to **to-dos, calendar+reminders, invoices, finance bookings, subscriptions**; actionable `DueList` widgets (invoice "bezahlt", reminder done/snooze, pantry −1) with undo; J/K/E/Space/Del everywhere with `ItemRow` | 2, 4, 5, 6, 8, 9, 12, 14, 19, 22 | L (split in 1a undo+contract, 1b modules if the PR grows) | **High for to-dos**: Fokushilfen PRs #57–#60 touch `todos` and the reminders flow and are unmerged. Recommend: merge #57–#60 first, or do to-dos last in 1b |
| **2** | **Create with minimal fields + duplicate** | "Mehr Felder" fold in event/reminder/todo/invoice/subscription/booking dialogs; defaults fixed (birthday date empty+required, invoice due suggestion, todo field focus, kind-aware category); last-used category/account per payee; `Kopieren` for booking/invoice/event/todo; Quick Capture: invoice, birthday, pantry, `n ` prefix, no confirm for certain finance parses, Ctrl+Enter full form for finance | 1, 3, 7, 10, 11, 16, 18, 21 | M–L | Medium: `quickCapture/**` and dialogs; check #59 ("Erfassen") first |
| **3** | **Jetzt + Erweitert** | `AdvancedToggle` hook + settings; Basis/Erweitert split per module (list in §4); "Jetzt" strip for calendar, finance, pantry; filter chips (invoices, bookings, pantry); finance Konten/Kategorien into advanced | 13, 15, 24 + all dialogs shorter | M | Low–medium (`manifest` type hotspot) |
| **4** | **Links + search to record** | Search hit opens the record (deep link `?open=<id>` per module); palette verbs ("bezahlt", "Timer starten …"); invoice→todo/reminder; location "Route" in rows; sub→bookings by payee; chat answer→note; pantry "alles nachkaufen" + low stock on widget | 25, 20, plus 4 smaller | M | Low |
| **5** | **Missing features (your pick)** | Candidates in §6, each S/M/L with the action it speeds up | – | per pick | – |

**Recommended order: 1 → 3 → 2 → 4 → 5**, because undo/row actions fix three of four annoyances and every later package builds on the contract; Erweitert second so the new dialogs in package 2 are built Basis-first. Alternative if you want visible gain per PR sooner: 1a (undo+contract, small) → 2 → 1b → 3 → 4.

## 4. Per-module sheets (Basis / Erweitert / quick actions missing / functions missing)

| Module | Basis (always visible) | Erweitert (switch) | Quick actions missing | Functions missing (effort) |
|---|---|---|---|---|
| **To-dos** | add field (focused), tick, title, due chip, priority dot, group Überfällig/Heute | estimate chips, Geplant date, "Irgendwann", recurrence, list select, subtasks section, list rename/new | swipe →done / ←morgen, ⋯ menu (Heute/Morgen/Nächste Woche, Prio), Space/J/K, undo on widget tick | duplicate (S), search `/` + priority filter chips (M), bulk move (M) |
| **Calendar** | month/week/day, "Heute", create (title, date, time, place), place in rows | end, notify lead, recurrence, note, defaultView settings | `+1 Tag/+1 Std` chips, create on tap in a day/slot, undo delete, Route button, duplicate | drag move/resize (L), search (M) |
| **Reminders** | list, "Jetzt/als Nächstes", snooze, done | recurrence editor, active switch, note | snooze + done per row (reuse `snooze.ts`), swipe, clear finished | – |
| **Finance** | month hero, add (amount first), bookings list, per-account balance | Konten + Kategorien tabs, opening balance, note, charts toggle, include-open/subs settings | inline category/amount/date, "same as last" suggestion, duplicate, undo, swipe delete | search/filter (M), recurring bookings (L), transfers (M), split (L, not recommended) |
| **Invoices** | open list grouped, "bezahlt" (also on home), add (payee, amount, due) | reference/ESR, note, paid history, paid-date | paid from widget, swipe →paid, duplicate/repeat, paid-date chip | partial payment (M), recurring invoice (M), capture target (M) |
| **Subscriptions** | list, monthly/yearly totals, next charge, cancel deadline (≤14 d) | cancelNoticeDays, note, full recurrence rule | inline price, pause with undo | price history (M), "gekündigt zum" state (S–M), link to bookings (M) |
| **Budgets** | budget cards (all, ok ones too), status | goals tab + withdraw, goal deadline/note | quick ± limit, drill-down to bookings | carry-over (M) |
| **Lists** | add field, tick, progress, clear/reset | list note/kind, routines, duplicate | recent-item chips, duplicate-name toast, swipe ← action | search (S), packing templates any time (S), recipe import (L, not recommended) |
| **Pantry** | filters Alle/Läuft ab/Nachkaufen, −/+ | minimum, place, note, expiry | undo on −, "alles nachkaufen", add to shopping toast | low stock on widget (S), capture target (S) |
| **Notes** | search, add, pinned Zettel | pin switch | `n ` capture prefix, `/` search, undo delete | checklist lines in a note (M) |
| **Bookmarks** | tiles, open, search, add | kind, tags, note, list/tile switch | row click opens link (list view), paste-URL button, undo, swipe done | – |
| **People** | search, next birthday, add (name, date), congratulate | tags, note, year-unknown | tap gift "geschenkt", swipe, undo, capture "Oma 12.3." | cross-person gift overview (S–M) |
| **Vault (Unterlagen)** | list with deadline, add | provider/notice fields beyond title+end | tappable widget rows, "verlängert +1 Jahr", undo | – |
| **Accounts (Tresor)** | search, list, detail | generator options, tags, bridge | copy icon on the row, `/` search (only allowed ways: copy/autofill/generator, behaviour unchanged) | – (no Android autofill exists: not in scope, platform work) |
| **Chat** | new chat, thread, composer | per-thread engine/system prompt/context, export, archive | "als Notiz speichern" per answer, undo delete | – |
| **Tools** | – | – | Timer: presets (5/10/25 min), Space start/pause, Enter to start (S) | – |

Disk/System: out of scope (parallel rework).

## 5. Click targets per action (25) and package

Targets as in 01 (tick 1, create with defaults 2, one field 2–3). Not reaching target is stated openly.

| # | Action | Today D / A | Target D / A | Package |
|---|---|---|---|---|
| 1 | Create appointment | 0–2 / 2 | 1 / 2 | 2 |
| 2 | Reschedule appointment | 5 / 7–9 | 2 / 2 (chips) | 1 |
| 3 | Create reminder | 0–3 / 2–3 | 1 / 2 | 2 |
| 4 | Snooze reminder from list | not possible | 2 / 2 | 1 |
| 5 | Tick todo (also widget, with undo) | 1 / 1 | 1 / 1 | 1 |
| 6 | Todo to tomorrow | 5 / 6–7 | 2 / 1 (swipe) | 1 |
| 7 | Create todo | 1 / 2 | 1 / 2 | 2 |
| 8 | Todo due/priority | 4–5 / 4–6 | 2 / 3 | 1 |
| 9 | Invoice paid (also from home) | 1 (+2 from home) / 1 | 1 / 1 | 1 |
| 10 | Create invoice | 3 / 4 | 2 / 3 | 2 |
| 11 | Enter expense | 2–3 / 3–4 | 2 / 2 | 2 |
| 12 | Booking category/amount | 3 / 3–4 | 2 / 3 | 1 |
| 13 | Balance/budget | 0 / 0 | 0 | 3 (visible without clicks) |
| 14 | Subscription price | 3 / 3 | 2 / 3 | 1 |
| 15 | Open bookmark | 1 / 1 | 1 | 1 (list row) |
| 16 | Quick note | 3–4 / 3 | 2 / 2 | 2 |
| 17 | Tick shopping | 1 / 1 | 1 | – |
| 18 | Add shopping item | 0–1 / 2 | 1 / 2 (chips for recent) | 2 |
| 19 | Pantry consume (undo) | 1 / 1 | 1 | 1 |
| 20 | Low pantry → shopping | 1 each | 1 total | 4 |
| 21 | Add birthday | 2 / 6–8 | 2 / 3 (capture) | 2 |
| 22 | Gift given | 4–5 / 5–6 | 1 / 1 | 1 |
| 23 | Copy password | 3 / 3 | 2 / 2 (icon on row) | 3 |
| 24 | Document expiry | 0–1 / 0–1 | 0–1, widget row opens record | 4 |
| 25 | "Where was that" | 5–8 + find row | 5 / 3, lands on record | 4 |

## 6. Candidates for package 5 (choose; each speeds up a daily action)
| Feature | Effort | Speeds up | Recommendation |
|---|---|---|---|
| Partial payment on invoices | M | 9 for installments | later |
| Recurring invoice/booking ("repeat monthly") | M / L | 10, 11 (rent, salary) | **yes**, invoice first |
| Subscription price history + "gekündigt zum" | M | 14 | yes |
| Checklist lines in a note | M | 16 | maybe |
| Drag to move events | L | 2 | after package 1 chips, only if still needed |
| Cross-person open-gift overview | S–M | 22 | cheap, yes |
| Transfers between accounts | M | 11 | maybe |
| Search/filter in bookings | M | 12, 13 | yes |

## 7. Questions for you (Stopp 2, bundled in the chat)
1. Order of packages (recommended 1 → 3 → 2 → 4 → 5) and whether to wait for Fokushilfen #57–#60 before touching to-dos.
2. Typed confirmation: which dialog do you mean (device reset "LÖSCHEN" in Settings → Über, the recovery screen, or the disk module)? Recommendation: keep it for the device reset only, replace by a two-step confirm (button + "Wirklich löschen") elsewhere; disk stays untouched (Rust rule).
3. Erweitert default for you: global default "Basis" with a global "Erweitert für alle Module" shortcut in settings?
4. Package 5 picks from §6.

**Model hint: evaluation finished – implementation with Sonnet after your release.**
