# feat/focus2-reminders-tab – for the next chat:
- "Erledigt" on a reminder = pause (`notify.enabled=false`); there is no done state. If a real one is wanted, it needs a data-model decision (not made here).
- `GroupedList` got `defaultClosed` (stored key then means "opened"); `ui/Patterns.module.css` raises a row with an open "⋯" menu (`:has(.actionsOpen)`), because `end` buttons painted over the menu.
- Rows still show "Einmalig · …" from `describeRecurrence`; dropping it is a small follow-up.
- Other pages with switch-per-row lists could use the same pattern (`ReminderRow` in `RemindersTab.tsx`).
