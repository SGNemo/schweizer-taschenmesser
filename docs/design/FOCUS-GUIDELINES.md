# Focus and attention aids – guidelines

Rules for every feature that helps with focus, starting, remembering or time. Not medical advice: established UX principles for low cognitive load. Plan and status: [../features/focus-aids.md](../features/focus-aids.md). Wording examples: [FOCUS-WORDING.md](FOCUS-WORDING.md). Visual rules stay in [DESIGN-SPEC.md](DESIGN-SPEC.md).

## Checklist for every new feature (answer before merging)
1. **Does it raise the stimulus load?** More elements, colours, motion or text on a view = justify it or remove something else.
2. **Is there an off switch?** Every aid is a setting in Einstellungen → "Fokus & Aufmerksamkeit" (on/off, intensity where it makes sense); nothing is forced; defaults are sensible, not maximal.
3. **Is the next step clear?** One primary action per view; an empty state names one next step.
4. **Is the wording calm?** No guilt, no pressure, no counters that only grow (see text rules).
5. **Does it survive an interruption?** State is kept (reload, app switch); nothing is lost when the user leaves.
6. **Is it tested?** Pure logic (selection, limits, state) with unit tests; the switch with an e2e case; reduced motion and AA contrast checked.

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

## Notification limits (for package 2, binding for any new reminder)
- Default: at most 3 notifications per hour and no notifications in quiet hours (default 22:00–07:00, configurable).
- Staggered leads are optional (default one lead); one gentle follow-up at most, never a chain.
- Snooze always offers sensible options (10 min, 1 h, this evening, tomorrow morning).
- No dark patterns: no fake urgency, no badges that cannot be cleared, no re-asking after "no".
- Everything local: reminders use the existing local scheduling (OS scheduler / Web Push of the user's own server); no tracking.

## Technical rules
- Settings: synced scope `focus` (`core/settings/focus.ts`), device-local state in `_meta` (never synced), registry section "Fokus & Aufmerksamkeit".
- New data fields are optional with a migration (`manifest.version`), never break old data.
- Design only from tokens and `@/ui` components; widgets from the base catalogue (DESIGN-SPEC §4a).
