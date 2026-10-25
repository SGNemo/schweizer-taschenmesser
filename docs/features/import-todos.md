# Import tasks from Todoist and Google Tasks

Files only: the user exports in the other app and picks the file in ToDos → "Startdaten einrichten" → "Aus Todoist oder Google Tasks". No account, no network, nothing uploaded. Same wizard as every importer: preview first, nothing stored before confirmation, one undoable batch.

## Where to get the export
- **Todoist:** project menu (⋯) → "Export as CSV" (one file per project; Settings → Backups also lists them). Completed tasks are not in it.
- **Google Tasks:** [takeout.google.com](https://takeout.google.com) → select only "Tasks" → `Tasks/Tasks.json`. All lists in one file, completed tasks included.

## What is read
| | Todoist CSV | Google Tasks JSON |
|---|---|---|
| Parser | `core/io/todoistCsv.ts` | `core/io/googleTasks.ts` |
| Title / note | `CONTENT`, `DESCRIPTION`, `TYPE=note` rows (appended to the task before) | `title`, `notes` |
| Priority | `PRIORITY` 1/2/3/4 → high/medium/low/none | none |
| Due day | `DATE`: ISO or plain text in de/en/es/fr/pt ("15. Oktober 2026", "Mar 5th", time ignored) | `due` (date part) |
| Subtasks | `INDENT` (one level; deeper goes under the top-level task) | `parent` (same) |
| Lists | the file name | the list titles |
| Done | not exported | `status=completed` |
| Skipped | sections, rows without a title | deleted, without a title |

Format is detected from the content (`detectTaskExport` in `core/io/taskImport.ts`), not the file name. Runtime: `modules/todos/importer.ts` (importer id `file`).

## Behaviour (calm by design)
- **Target:** an existing list (default: first) or "a separate list for each source list" (same name as an existing list, case-insensitive → reuse it; otherwise a "Neue Liste" row in the preview, which the user can untick).
- **Completed tasks:** left out by default (switch "Erledigte Aufgaben"); a note says how many.
- **Repeats and relative dates** ("every Monday", "tomorrow") are never converted: nothing repeats automatically. The text goes into the task note ("Wiederholung in der Quelle: …"), and a note above the preview counts them.
- **Duplicates:** list + title, as for pasted lines; completed tasks only match completed ones.
- Cap 1000 tasks per file (noted). Fixtures (invented) in `core/io/__fixtures__/`.
- Tests: `core/io/{todoistCsv,googleTasks}.test.ts`, `core/importer/moduleImporters.test.ts`, `e2e/import-todos.spec.ts`.

## Not built
Todoist labels, projects as sub-lists, reminders, comments' authors; Google Tasks repeats (Calendar owns them). Add on request.
