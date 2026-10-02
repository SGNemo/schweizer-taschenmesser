# Focus and attention aids – plan (2026-10-02)

Result of the evaluation chat (phases 1–2, branch `feat/adhd-friendly`). Mockups: [`../design/mockups/adhd/`](../design/mockups/adhd/) (standalone HTML + PNG, dark, desktop + phone). Principles and text rules: [`../design/FOCUS-GUIDELINES.md`](../design/FOCUS-GUIDELINES.md) (written in package 1). Every aid has a switch in Settings → "Fokus & Aufmerksamkeit" (new core section, category `darstellung` or own category, decided in package 1); nothing is forced, no streak loss, no guilt wording, no daily counters in red.

## Diagnosis (short)
- Home starts with up to 6 attention chips, 4–5 of them red; no greeting/date, no single next step; phone home = 16 widgets (≈ 5300 px).
- ToDo list leads with 8 red "Überfällig: <date>" rows; no duration, no first step, no focus; the timer tool is 25/5 fixed, not persisted, invisible outside the tool.
- Reminders: one lead per event, no snooze, no quiet hours, no rate limit, ToDos never notify.
- Search has no history; nothing marks "done today"; no end-of-day view.
- Good today: timeline with "Jetzt" marker and "Als Nächstes", quick capture parser, "Irgendwann", undo everywhere, one accent, reduced motion respected.

## Decisions (maintainer, 2026-10-02)
- Home variant **A1** (`home-a1-karte.html`): "Jetzt dran" card on top, "Heute" plan (≤ 3 items, done count), "Als Nächstes" with time-to-next and day progress, "Wartet noch" collapsed, then the existing widgets.
- Focus mode **B1** (`focus-b1-ring.html`): one task, step list, ring timer with soft end, Fertig / Pause / Beenden; everything else hidden; survives reload; small top-bar indicator.
- Overdue: one collapsed chip "Wartet noch · n", calm rows ("offen seit letzter Woche", no day counter), red only for money deadlines; "Neu planen" spreads ToDos over the next days.
- Package order: **1 Anfangen** (this branch) → **2 Erinnerungen** → **3 Erfassen/Ruhe/Wiederfinden** → **4 Fortschritt**. One branch and PR per package.

## Package 1 "Anfangen" (this branch) – scope
| # | Item | Touches | Default |
|---|---|---|---|
| 1 | Next-one-thing selection (`modules/todos/next.ts`: due today/overdue first, then planned-for-today, shortest estimate, priority; skip list in `_meta` device-local) | home, todos logic + tests | on |
| 2 | Day plan "Heute" (Task field `plannedFor: YYYY-MM-DD`, max 3 shown, "Erledigt heute" line) | todos schema + migration + seed, home widget | on, max 3 |
| 3 | Attention strip compact: one collapsed chip, calm overdue wording, red only for money; "Neu planen" action | `home/AttentionStrip.tsx`, `contributions.ts`, strings, ToDo row | compact on |
| 4 | Focus mode `/focus/:taskId`: ring timer (default 25 min, 5–60), steps = subtasks, Pause, +5 Min, soft end (toast + optional beep), state in `_meta` device-local, top-bar indicator | new `web/src/focus/`, router, TopBar, timer engine reuse | on, 25 min |
| 5 | Estimate + first step per ToDo (`estimateMin` 5/15/30/60 chips in editor, quick capture "15min"), template "3 kleine Schritte" | todos schema, TaskEditor, quickCapture parser | optional field |
| 6 | "Als Nächstes" time-to-next + day progress in the calendar widget | calendar widget | on |
| 7 | Settings section "Fokus & Aufmerksamkeit": switches/intensity for 1–6 | settings registry, strings, inventory test | – |
| 8 | Docs: FOCUS-GUIDELINES.md, STATUS/CHATS/PROMPT-TEMPLATES/CLAUDE.md per phase 3, glossary of wording | docs | – |
Verification: unit tests for next-one-thing, focus state, overdue wording; e2e `focus.spec.ts` (start/finish focus, plan 3 things, everything switchable); a11y + reduced motion; screenshots before/after (dark/light, desktop/phone).

## Later packages (not in this branch)
- **2 Erinnerungen:** staggered lead (1 d · 1 h · 10 min), snooze options (10 min, 1 h, heute Abend, morgen früh, "wenn ich am PC bin" = device flag), quiet hours, max per hour, one gentle follow-up, ToDos with date notify at a set time; "Woran war ich" card. Touches `core/notifications/*`, `nativeSchedule`, push payload, calendar settings. Mockup `reminder-c1-snooze.html`.
- **3 Erfassen/Ruhe/Wiederfinden:** no type question (default inbox, sort later), Ctrl+Enter to full form, time on ToDos becomes a reminder, quick-add dialog without the second link list; search history + recently used in Ctrl+K; focus theme (home preset with 3 widgets), text size 3 steps, in-app motion switch.
- **4 Fortschritt:** gentle streaks with rest days for recurring ToDos, positive week review, routine templates (Morgen, Abend, Wochenplanung) as checklists.
