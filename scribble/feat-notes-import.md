# feat/notes-import – for the next chat:
- Notes have no tag field; tags ride as a final `#tag` line. If the model ever gets `tags`, change `withTagLine` use in `core/io/markdownNote.ts` / `googleKeep.ts` and `modules/notes/importer.ts` (dedupe key stays title + 80 chars).
- Framework got two small additive fields: `ImporterMeta.multiple` / `textLabel`, `ImportInput.files` (`pickTextFiles`). Other file importers (CSV, ICS) could offer multi-select the same way.
- Not done on purpose: ZIP (dependency), Markdown preview, Keep timestamps / attachments / colours, Obsidian wikilink resolution.
- E2E files are chosen through the `filechooser` event (input is created in memory).
