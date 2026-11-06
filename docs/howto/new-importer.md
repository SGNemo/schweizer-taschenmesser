# New importer for another app

Code: `web/src/importers/<source>/`. The generic flow (preview, duplicates, batch id, "Import rückgängig", report) stays in `core/importer`; a source only says what it recognises and how its files map to a module.

1. **Parser** (`parse.ts`): pure functions on `SourceFile[]` (`{ name, text }`). No React, no Dexie, no `DOMParser` (it must run in a Worker), no `@/strings`. Count what you leave out with `addSkip(counts, reason)` (`SkipReason` in `types.ts`), never content.
2. **Source** (`source.ts`): `SourceDef` with `id`, `targets` (`{ moduleId, importerId }` = an importer in the module's `contributions.onboarding`, or `{ moduleId, route }` for the vault), `extensions`, `detect(files)` (0..1 from names and the start of the content only), optional `summarize(files)` (counts for the "recognised" line, cheap, no content). Register it in `importers/registry.ts`; keep the more specific source first.
3. **Module side**: the module runtime (`modules/<id>/importer.ts`) calls the parser (heavy ones through `runJob` from `importers/run.ts`, add the job to `importers/jobs.ts`) and builds `ImportCandidate`s with a `dedupeKey`. Pass `result.skipped` back in `ImportParseResult.skipped`; the wizard stores it as the batch's `report`.
4. **Texts**: `importers.sources.<id>`, `importers.why.<id>` (the reason shown with the recognition) (and a reason if new) in `strings.ts` plus the four catalogs; a migrate tile is optional (`core/setup/migrate.ts`, `MigrateStep.tsx`).
5. **Tests**: invented fixtures in `importers/__fixtures__/` (special characters, time zones, repeats, attachments, a broken file), parser test next to the parser, one flow test in `importers/flow.test.ts` (preview → commit → duplicate on second run → undo).

Limits: archives are unpacked by `importers/files.ts` (entry, size and path guards); text files over 50 MB and archives over 300 MB are refused. Binary files are only counted ("Anhang"). Nothing is written before the user confirms the preview, so cancelling a read leaves no state; `commitImport` takes back its own writes when it fails.
