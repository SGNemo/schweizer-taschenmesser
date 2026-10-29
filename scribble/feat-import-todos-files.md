# feat/import-todos-files – for the next chat:
- Todoist CSV + Google Tasks JSON import is in `core/io/{todoistCsv,googleTasks,taskImport}.ts` and `modules/todos/importer.ts` (importer id `file`); notes in `docs/features/import-todos.md`.
- Wizard option keys `fileList` (lists + `@source`) and `includeDone`; the text importer keeps `listId`.
- E2E: the "Startdaten einrichten" button on `/todos` only shows while the module is empty; later use `/settings/module`.
- Unticking the "Neue Liste" row in the preview leaves its tasks pointing at a missing list (the preview does not link rows). Candidate dependencies in `core/importer` would fix it; not done (core framework).
- Not read: Todoist labels/reminders/sections as sub-lists. Add on request.
