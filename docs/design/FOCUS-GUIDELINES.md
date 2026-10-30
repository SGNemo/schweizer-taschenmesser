# Focus and attention aids – guidelines

Rules for every feature that helps with focus, starting, remembering or time. Not medical advice: established UX principles for low cognitive load. Plan and status: [../features/focus-aids.md](../features/focus-aids.md). Wording examples: [FOCUS-WORDING.md](FOCUS-WORDING.md). Visual rules stay in [DESIGN-SPEC.md](DESIGN-SPEC.md).

## Checklist for every new feature (answer before merging)
1. **Does it raise the stimulus load?** More elements, colours, motion or text on a view = justify it or remove something else.
2. **Is there an off switch?** Every aid is a setting in Einstellungen → "Fokus & Aufmerksamkeit" (on/off, intensity where it makes sense); nothing is forced; defaults are sensible, not maximal.
3. **Is the next step clear?** One primary action per view; an empty state names one next step.
4. **Is the wording calm?** No guilt, no pressure, no counters that only grow (see text rules).
5. **Does it survive an interruption?** State is kept (reload, app switch); nothing is lost when the user leaves.
6. **Is it tested?** Pure logic (selection, limits, state) with unit tests; the switch with an e2e case; reduced motion and AA contrast checked.

7. **Readability:** Does the colour carry meaning (state, category, urgency) and is it paired with text or an icon? Is the group recognisable (space, small header, count)? Is the line too long (> 68 ch)? Is long text offered with the reading aid, and does it stay off for numbers, inputs and the vault?

9. **What could be removed instead?** (mandatory since focus audit 2) Name one element, setting or hint that this feature makes redundant, or state why nothing can go. A feature that only adds needs a situation from the usage diary (`docs/product/focus/09-diary-template.md`) that it solves.

8. **Clicks:** Is the everyday action on a list one tap/swipe (row action or ⋯ menu, with undo), and is anything rare moved into the module's "Erweitert" layer (never anything important only there)? Count taps before/after in the PR ([howto/list-actions.md](../howto/list-actions.md), [howto/advanced-fields.md](../howto/advanced-fields.md)).

## Principles
- **One thing at a time.** Offer one next action, show the rest collapsed. Plans hold at most 3 main items per day.
- **Start small.** Estimates in short steps (5/15/30/60 min), first step visible, "Anfangen" instead of "Planen".
- **Time made visible.** Time until the next appointment, a "Jetzt" marker, a soft timer end. Never a silent countdown that cannot be hidden.
- **Calm over stimulus.** No extra animation except feedback to an action; `prefers-reduced-motion` respected; colour always paired with text or icon; red only for overdue money deadlines and exceeded budgets.
- **Positive and optional.** Progress ("Erledigt heute", "Gut dabei") is shown quietly and can be switched off. Streaks (if any) have rest days and never show a loss.
- **Fewer decisions.** Defaults, suggestions, "Später" and "Etwas anderes" instead of blank fields; sort the inbox later.
- **Everything undoable.** Done, moved, replanned: toast with "Rückgängig".

## Text rules (German UI, short, friendly)
- Say what is possible, not what was missed: "Wartet noch" instead of "Überfällig seit 12 Tagen".
- No "schon wieder", "immer noch", "du hast vergessen", no exclamation marks, no emoji, no all-caps.
- No counters that grow daily on old items; show the date or "offen seit letzter Woche".
- Buttons are verbs of the next step ("Anfangen", "Später", "Neu planen"); max 3 buttons in a row.
- Empty states and completions are warm and brief ("Alles erledigt. Zeit für etwas Schönes.").
- Texts live in `web/src/strings.ts`, are i18n-ready (functions for plurals), one sentence where possible.

## Notification limits (binding for any new reminder)
- Default: at most 3 notifications per hour (the rest is folded into one summary) and quiet hours 22:00–07:00 for automatic extras; both configurable, both in `core/notifications/policy.ts`. Anything the user set explicitly (an event's own lead, "Später") is never moved or dropped.
- A new kind of automatic notification is `soft: true`, goes through `collectDue`, has a switch in "Ruhige Erinnerungen", and defaults to off unless it replaces something noisier (the morning digest replaces per-task notifications).
- Staggered leads are optional (default one lead). Automatic extras (digest, stages) get one gentle follow-up at most, never a chain. A reminder the user set explicitly may repeat until answered (maintainer decision, focus round 2): interval settable (default 30 min), a cap per reminder (default 6, then a quiet end visible in the notification centre), quiet hours, Stumm and the per-hour limit still apply, the wording stays neutral ("Noch offen: …"), and "Erledigt" or "Später" stops it on every device (details: [repeat-reminders](../features/repeat-reminders.md)).
- Snooze always offers sensible options (10 min, 1 h, this evening, tomorrow morning, "wenn ich am PC bin").
- No dark patterns: no fake urgency, no badges that cannot be cleared, no re-asking after "no".
- Everything local: reminders use the existing local scheduling (OS scheduler / Web Push of the user's own server); no tracking.

## Technical rules
- Settings: synced scope `focus` (`core/settings/focus.ts`), device-local state in `_meta` (never synced), registry section "Fokus & Aufmerksamkeit".
- New data fields are optional with a migration (`manifest.version`), never break old data.
- Design only from tokens and `@/ui` components; widgets from the base catalogue (DESIGN-SPEC §4a).
