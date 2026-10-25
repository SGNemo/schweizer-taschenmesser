# Notes import (Obsidian / Markdown, Google Keep)

Start-data wizard of the Notes module (`modules/notes/{onboarding,importer}.ts`), same frame as every module: choose → preview (untick, duplicates marked) → one undoable batch.

## Inputs
| Importer | Input | Result |
|---|---|---|
| `text` "Markdown einfügen" | pasted Markdown | one note (first heading = title, else no title) |
| `file` "Markdown-Dateien oder Google Keep" | several `.md`/`.markdown`/`.txt` and/or Keep `.json` at once (`ImporterMeta.multiple`, `pickTextFiles`) | one note per file / per Keep note |

No ZIP handling (would be a dependency): unzip the Obsidian vault export or the Takeout archive first, choose the files.

## Parsers (`core/io`, pure)
- `markdownNote.ts`: front matter `title`, `tags`/`tag` (list, `[a, b]`, comma text); else first heading (dropped from the text when it opens the text); else file name. `#tags` in the text are recognised (not in code, not `#1`). `[[Wikilinks]]` stay text. Empty files are skipped and counted.
- `googleKeep.ts`: `title`, `textContent`, `listContent` → `- [ ]` / `- [x]` list, `labels` → tags, `isPinned` → pinned; `isTrashed` / `isArchived` left out and counted; a JSON that is no Keep note is reported. Object or array per file.

## Rules
- The notes model is untouched. It has no tag field: tags that are only in front matter / Keep labels are appended as a last `#tag #tag` line of the text. Timestamps (Keep) are ignored, `createdAt` is set by the repo.
- Dedupe key = normalised title + first 80 characters of the text (case and whitespace ignored), against stored notes and within the import.
- Markdown stays raw text; no preview feature.
- Nothing leaves the device, nothing goes to the AI.
