# Planen group – module notes (calendar first)

Identity rules: [design/MODULE-IDENTITY.md](../design/MODULE-IDENTITY.md). One short section per module, added by its package.

## Calendar and reminders (`modules/calendar`)

- **Views:** `month · week · day · agenda · year` (`views.ts`: `rangeFor`, `shiftDate`, `viewTitle`, `weekNumberOf`). The hour grid (`components/TimeGrid.tsx`) exists from 1400 px; below that week/day are lists.
- **Hour grid editing:** pointer drag moves, the bottom edge stretches, a drag over an empty part draws a new slot; `Alt+↑/↓` moves by 15 min, `Alt+Shift+↑/↓` stretches. Maths is pure in `dragMath.ts` (`movedSlot`, `resizedEnd`, `slotFromDrag`, snap 15 min). Only own, single-day, timed events drag; a series is changed in the editor (toast says so). Every change goes through `changeWithUndo`.
- **Named calendars:** collection `calendar_calendar` (`name`, `tone` = category palette index, `visible`, `order`), event field `calendarId`. A hidden calendar's events are filtered in `calendar.ts` (they stay stored); an event whose calendar was deleted is shown again. Chips show name + dot (`components/CalendarsBar.tsx`); "Kalender verwalten" is in advanced mode.
- **Exceptions:** `exdates` on a recurring event ("Nur den Termin am … entfernen" in the editor); `expandEvent` and the notification source skip them.
- **Holidays:** `holidays.ts` computes them (Easter rule + table) for DE (nationwide or one state), AT, CH; setting `holidayRegion`, off by default; never fetched. A holiday that depends on the community is left out on purpose.
- **Reminders tab:** time ring (`components/BellRing.tsx`, built on the shared `Ring`, never animated), "Später" presets and "Erledigt" as before, "Erledigte entfernen" (undoable), extra lead times per event (`notify.extraMinutes`, advanced fields; key suffix `:x<min>` in `notifications.ts`).
- **Links inside the group:** "Als ToDo merken" emits `todo.requested` with `dueDate`; modules never import each other.
- **Not built (proposals):** weather per day, "Als Ort speichern" (`place.requested`, needs the maps consumer), device-local reminder history.
