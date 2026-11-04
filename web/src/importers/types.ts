/**
 * Importers for data from other apps. One folder per source (`importers/<source>/`), each with
 * plain-data `source.ts` (what it recognises, where the data goes), pure parsers (no React, no
 * database, no `DOMParser`, so they run in a Worker as well as in tests) and invented fixtures.
 * The module runtimes (`modules/<id>/importer.ts`) turn the parsed data into candidates for the
 * generic preview/commit/undo flow in `core/importer`.
 */

/** One file of an export; `name` is the path inside an archive (`Takeout/Keep/a.json`). */
export interface SourceFile {
  name: string;
  text: string;
}

/** Why an entry of the source did not become a record. Texts: `t.importers.reasons`. */
export type SkipReason =
  'trashed' | 'empty' | 'unreadable' | 'attachment' | 'unsupported' | 'tooMany' | 'done';

/** What a parser left out, counted by reason. Counts only – never content. */
export type SkipCounts = Partial<Record<SkipReason, number>>;

export interface ImportReport {
  skipped: SkipCounts;
}

export function addSkip(counts: SkipCounts, reason: SkipReason, n = 1): void {
  if (n > 0) counts[reason] = (counts[reason] ?? 0) + n;
}

export interface SourceTarget {
  moduleId: string;
  /** Id of the importer in the module's `contributions.onboarding` (the preview/undo wizard). */
  importerId?: string;
  /** Instead of the wizard: a page that does the import itself (the vault, behind its password). */
  route?: string;
}

/** The contract every source folder fulfils. */
export interface SourceDef {
  id: string;
  /** Where the data goes; the first target is the one opened after detection. */
  targets: SourceTarget[];
  /** File types the source is recognised by (documentation and `<input accept>`). */
  extensions: string[];
  /** 0 = not this source … 1 = certain. Looks at names and the start of the content only. */
  detect(files: readonly SourceFile[]): number;
}

/** Entry of the "which app is this from?" list; `confidence` is 0..1. */
export interface Detection {
  source: SourceDef;
  confidence: number;
}
