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
- **Not built (proposals):** weather per day, "Als Ort merken" (`place.requested`, needs the maps consumer), device-local reminder history.

## ToDos (`modules/todos`)

- **Views, not states:** `views.ts` (`viewOf`, `movePatch`, `overdueTasks`): Heute (due/planned ≤ today) · Demnächst (dated later, or `startDate` in the future) · Irgendwann (`someday` flag **or** no date) · Erledigt. The page shows them as chips next to "Alle" (the grouped list, default) and "Board" (`components/BoardView.tsx`, same four columns). Only `someday` is stored; moving a card writes the dates (`movePatch`), "Erledigt" goes through `setDone` so repeats keep working.
- **Board:** drag a card onto a column or use its "⋯" menu ("Verschieben nach …", the keyboard/touch way); "Morgen" is one click on cards in Heute. Every move is one undoable change.
- **New task fields (`manifest.version 4`, no data rewrite):** `startDate` (hidden from the plain list and Heute until then), `tags` (`tags.ts`, free words without `#`, filter chips under "Mehr Felder"), `checklist` (lines inside a task), `links` (`note|mail|invoice|event` + id + title; other modules fill it through `todo.requested`'s `link`, the task opens `<module>?open=<id>`). Lists get `kind: 'project'` (progress bar done/all).
- **Head:** `components/TodayCard.tsx` (the signature `todayCard`, built on `HeroFigure` in `HeroSlot`): count, summed estimate, the next task. `identity.feedback: 'tick'` = a ≤ 250 ms check pop on the row checkbox (switched off by the global motion rules).
- **Calm rules kept:** "Alle auf heute" appears only in the plain wording (calm mode keeps "Neu planen"); no streak or guilt text was added.
- **Not built:** drag reorder inside the plain list (`order` stays manual via the editor), AI `postpone`/`tag` actions, widget changes (`next` already has tick and "Später").

## Karten & Orte (`modules/maps`)
- **Head:** `components/PinHead.tsx` (the signature `pin`, in `HeroSlot`): a still pin on two quiet rings in the module hue plus the last saved place as text. It draws no map, so the head fetches nothing (the map and its tiles still start only with the Karte tab and the notice).
- **Places tab:** category chips (only categories in use), search words over name/address/note, sort Zuletzt/Name, pinned first (`placesView.ts`, pure). Each row has a **Navigieren** button: `geo:` on Android, OpenStreetMap elsewhere (`placeLink`); the "⋯" menu keeps the other apps.
- **Places from appointments:** the calendar editor's "Als Ort merken" opens `/maps?q=<location>`: the Karte tab with the words in the search field. Nothing is searched until the button is pressed (own map first, online only after the click), then "Ort speichern" as before. Modules stay unlinked: it is a URL, not an import.
- **Not built:** AI actions (a place needs coordinates, and the assistant never gets or dictates them; the registry test also needs a `create` example), a "last place + Navigieren" widget (the tiles widget stays), a static map snippet in the head (would fetch tiles on every open), offline map piece: the existing "Eigene Karte" (Karte tab → regions) covers it.

