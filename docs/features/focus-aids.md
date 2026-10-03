# Focus and attention aids – plan (2026-10-02)

Result of the evaluation chat (phases 1–2, branch `feat/adhd-friendly`). Mockups: [`../design/mockups/adhd/`](../design/mockups/adhd/) (standalone HTML + PNG, dark, desktop + phone). Principles and text rules: `docs/design/FOCUS-GUIDELINES.md` (written in package 1). Every aid has a switch in Settings → "Fokus & Aufmerksamkeit" (new core section, category `darstellung` or own category, decided in package 1); nothing is forced, no streak loss, no guilt wording, no daily counters in red.

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

## Package 1 "Anfangen" (this branch) – scope (built; status below)
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
- **2 Erinnerungen (built, PR 58):** staggered lead (1 d · 1 h · 10 min), snooze options (10 min, 1 h, heute Abend, morgen früh, "wenn ich am PC bin" = device flag), quiet hours, max per hour, one gentle follow-up, ToDos with date notify at a set time; "Woran war ich" card. Touches `core/notifications/*`, `nativeSchedule`, push payload, calendar settings. Mockup `reminder-c1-snooze.html`.
- **3 Erfassen/Ruhe/Wiederfinden:** no type question (default inbox, sort later), Ctrl+Enter to full form, time on ToDos becomes a reminder, quick-add dialog without the second link list; search history + recently used in Ctrl+K; focus theme (home preset with 3 widgets), text size 3 steps, in-app motion switch.
- **4 Fortschritt:** gentle streaks with rest days for recurring ToDos, positive week review, routine templates (Morgen, Abend, Wochenplanung) as checklists.

## Implementation notes for package 1 (from the code reading, 2026-10-02)
- Home is core, modules never import each other: "Jetzt dran" + "Heute" plan = a **new widget of the todos module** (`todos:next`, size l), "Als Nächstes" = new calendar widget (`calendar:next`, size s); `home/layout.ts` `orderWidgets` gets a default-first list for these keys.
- Focus mode = a **todos route** `/todos/focus/:id` (`modules/todos/routes/FocusPage.tsx`, layout `narrow`); timer state device-local via a small core helper (`core/focus/state.ts`, `_meta` key `focus.state`), reused by a TopBar indicator; reuse `tools/timer/logic.ts` countdown arithmetic. Esc → back to `/todos`.
- ToDo fields `plannedFor`, `estimateMin` are optional → `manifest.version` 2 + no-op migration entry, seed update, `inventory.test.ts` untouched (module settings unchanged).
- Settings: new synced scope `focus` (`core/settings/focus.ts`), section `focus` in `pages/settings/sections.tsx` (category `darstellung`, order 15), add to `inventory.core.json`.
- Calm overdue: todos `attention.ts` reads the focus settings (`getSettings`) and switches tone to `warning` + wording "n ToDos warten"; ToDo row and widget drop the day counter when the setting is on.
- "Neu planen": pure function `replan(tasks, today, perDay)` in `modules/todos/logic.ts`, applied through `undoableWithToast`.

## Package 1 – built (2026-10-02)
All eight items are in `feat/adhd-friendly`. Deviations from the plan above, decided while building:
- Focus screen route is `/todos/focus/:taskId` (module route); the shell hides its chrome for any `/<module>/focus/…` (`core/focus/path.ts`). Esc **leaves** the screen, the round keeps running; "Runde beenden" ends it.
- "Heute" plan and "Jetzt dran" are one widget (`todos:next`, default size l, first on home by default via `FRONT_WIDGETS` in `home/layout.ts`); "Als Nächstes" is `calendar:next` (KPI type).
- "Wartet noch": in the calm strip every non-"today" item folds into one `<details>` line; waiting ToDos use the warning tone, plain dates, no day counter; "Neu planen" lives on the ToDos page.
- Focus timer end: toast once when the app is open (also after reopening); no OS notification while the app is closed (package 2 can add it with the reminder work).
- Not built (later): the "Woran war ich" card (package 2), quick-capture Ctrl+Enter and inbox changes (package 3).

## Where things live
- Settings: `web/src/core/settings/focus.ts` (synced scope `focus`, defaults `DEFAULT_FOCUS`), section `web/src/pages/settings/FocusSection.tsx` (Darstellung, order 15), pinned in `pages/settings/inventory.test.ts`.
- Device-local state: `web/src/core/focus/{session,state,path,useNow,announce}.ts` (`_meta` keys `focus.session`, `focus.skipped`; never synced or backed up).
- ToDos: selection logic `modules/todos/next.ts` (`pickNext`, `dayPlan`, `waitingTasks`, `replan`), widget `widgets/NextWidget.tsx`, focus screen `routes/FocusPage.tsx`, start helper `focus.ts`, fields `plannedFor` and `estimateMin` (manifest version 2).
- Calendar: widget `modules/calendar/widgets/NextWidget.tsx`, helpers `until.ts`.
- Shell: `layout/AppShell.tsx` (no chrome on focus routes), `layout/FocusWatcher.tsx` (once-only "Zeit ist um"), `layout/FocusIndicator.tsx` (top bar), `home/AttentionStrip.tsx` (calm mode), `home/layout.ts` (`FRONT_WIDGETS`).
- Quick capture: `quickCapture/parser/estimate.ts` ("15 min", "1 Std"; ToDos only).
- Tests: `core/focus/*.test.ts`, `modules/todos/next.test.ts`, `modules/todos/__tests__/{focusPage,nextWidget,attention}.test.tsx`, `modules/calendar/__tests__/nextWidget.test.tsx`, `home/AttentionStrip.test.tsx`, `e2e/focus.spec.ts`.

## Package 2 "Erinnerungen" – built (2026-10-03, branch `feat/focus-reminders`, stacked on package 1)
- **One place for all channels:** `core/notifications/collect.ts` (`collectDue`) gathers module sources plus the app's own (Später entries, end of a focus round) and applies the policy; in-app scheduler, Android schedule and Web Push upload all call it. Policy in `core/notifications/policy.ts` (pure, tested).
- **Quiet hours** (default 22:00–07:00) move only automatic extras (`DueNotification.soft`: staged leads, follow-up, morning digest) to their end; what the user set explicitly (an event's own lead, "Später") is never moved. **Limit** (default 3 per clock hour, 0 = off): the first `max − 1` stay, the rest of that hour folds into one "Weitere Erinnerungen · n".
- **Staged leads** (off; choices 1 Tag, 2 Std, 1 Std, 30 Min, 10 Min; calendar source) and **one gentle follow-up** for reminders (off; +30 min, stopped by "Erledigt").
- **Morning digest** (on, 09:00): one notification listing today's ToDos (due or planned) instead of one per task (`modules/todos/notifications.ts`).
- **In-app card** (on): while the app is open a due reminder shows as a card with Erledigt / Später (`layout/ReminderPrompt.tsx`, `core/notifications/inapp.ts`); no OS permission needed. Später: 10 Min, 1 Std, Heute Abend (before 17:00), Morgen früh, Wenn ich am PC bin (not offered on the desktop app). Entries live in the synced settings scope `reminders` (`core/notifications/snooze.ts`); "Am PC" fires once on the desktop app and is removed.
- **End of a focus round** is a notification (`core/focus/notify.ts`), so the OS can announce it while the app is closed.
- **"Woran war ich?"** (on): `core/focus/context.ts` + `layout/ResumeTracker.tsx` remember the last place and when the app was left; after 20 min away the home screen offers the way back (and mentions an open focus round). Setting in "Fokus & Aufmerksamkeit".
- Settings: Einstellungen → Benachrichtigungen → "Ruhige Erinnerungen" (`pages/settings/CalmRemindersSection.tsx`, synced scope `focus`).
- **Known limits:** notifications that the Android OS fires itself have no buttons, so "Später" is only offered in the in-app card (open the app, answer there); Web Push payloads of staged/digest items go through the same encrypted upload as before.
- Tests: `core/notifications/{policy,snooze,collect,scheduler}.test.ts`, `modules/{calendar,todos}/__tests__/notifications.test.ts`, `layout/ReminderPrompt.test.tsx`, `home/ResumeCard.test.tsx`, `core/focus/context.test.ts`, `e2e/reminders.spec.ts` (the existing OS-popup test now switches the card off first).
