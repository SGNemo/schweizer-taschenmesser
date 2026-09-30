import type { MailFinding } from '@/core/connectors/types';
/**
 * Start-data importers. A module declares them in `contributions.onboarding`; the generic wizard
 * (`OnboardingWizard`) shows them, runs the chosen one, previews the result and only after the user's
 * confirmation writes it – as one undoable batch.
 *
 * The description (`ImporterMeta`) is plain data so manifests stay tiny; the code that parses input
 * lives in a lazily loaded runtime (`ImporterRuntime`).
 */

export type ImporterKind =
  /** Pasted text, one line = one entry. */
  | 'text'
  /** A file chosen by the user (CSV, ICS, HTML, JSON …). */
  | 'file'
  /** Ready-made suggestions the user ticks. */
  | 'template'
  /** A small form for a single entry. */
  | 'form'
  /** Suggestions found by a connector scan (Phase 3). */
  | 'connector';

export interface Choice {
  value: string;
  label: string;
}

/** A field of a `form` importer or an option that applies to the whole import. */
export interface ImportField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** Fixed choices for `select`. */
  choices?: Choice[];
  /** `select` whose choices depend on stored data; resolved by `ImporterRuntime.optionChoices`. */
  dynamicChoices?: boolean;
  defaultValue?: string;
}

export interface TemplateMeta {
  id: string;
  label: string;
  detail?: string;
  /** Pre-ticked in the wizard. */
  preselected?: boolean;
}

export interface ImporterMeta {
  id: string;
  kind: ImporterKind;
  label: string;
  description?: string;
  /** kind `text`: shown in the empty text box. */
  placeholder?: string;
  /** kind `file`: value for `<input accept>`. */
  accept?: string;
  /** kind `form`: the fields. */
  fields?: ImportField[];
  /** kind `template`: the suggestions. */
  templates?: TemplateMeta[];
  /** Options chosen before parsing (target list, account …). */
  options?: ImportField[];
  /** kind `connector`: id of the connector that provides the suggestions. */
  connectorId?: string;
  /** kind `connector`: the connector feature that must be switched on (`mail`). */
  connectorFeature?: string;
}

export interface OnboardingDef {
  /** May be empty: the module has no start-data path (yet). */
  importers: ImporterMeta[];
  /** Required as soon as `importers` is not empty. */
  load?: () => Promise<{ default: ImporterRuntime }>;
}

export const noOnboarding: OnboardingDef = { importers: [] };

/** What the wizard hands to an importer. */
export type ImportInput =
  | { kind: 'text'; text: string }
  | { kind: 'file'; text: string; fileName: string }
  | { kind: 'template'; ids: string[] }
  | { kind: 'form'; values: Record<string, string> }
  /** Suggestions a connector scan found (`MailFinding`s); nothing of the source text is included. */
  | { kind: 'connector'; findings: MailFinding[] };

export interface ImportContext {
  /** 'YYYY-MM-DD' (from `core/time/now`). */
  today: string;
  /** Values of `ImporterMeta.options`. */
  options: Record<string, string>;
  /** Known before parsing so a candidate can reference another candidate by id. */
  batchId: string;
}

export interface ImportCandidate {
  /** Collection of the owning module. */
  collection: string;
  /** Fixed record id; defaults to `imp-<batchId>-<n>`. */
  id?: string;
  /** Data for the collection's Zod schema (validated in the preview and again on commit). */
  data: Record<string, unknown>;
  /** Headline of the row in the preview. */
  label: string;
  detail?: string;
  /** Stable key for duplicate detection against stored records and within the import. */
  dedupeKey: string;
  /** Reminder for the user, shown as a badge (e.g. "Betrag unsicher"). */
  warning?: string;
  /** Reference to the origin (mail id …). */
  ref?: string;
}

export interface ImportParseResult {
  candidates: ImportCandidate[];
  /** German hints about what could not be imported ("2 Zeilen übersprungen …"). */
  notes: string[];
}

export interface ImporterRuntime {
  parse(
    importerId: string,
    input: ImportInput,
    ctx: ImportContext,
  ): Promise<ImportParseResult> | ImportParseResult;
  /** Dedupe keys of the records that already exist in a collection. */
  existingKeys(collection: string): Promise<Set<string>>;
  /** Choices for options with `dynamicChoices`. */
  optionChoices?(key: string): Promise<Choice[]>;
}

/** A candidate after the checks of the preview step. */
export interface PreviewRow {
  index: number;
  candidate: ImportCandidate;
  /** Already stored, or repeated within this import. */
  duplicate: boolean;
  /** Reason the Zod schema rejected the data; such rows cannot be imported. */
  invalid?: string;
  selected: boolean;
}

/** Local record of one import (`_imports`), the basis of "Import rückgängig machen". */
export interface ImportBatch {
  id: string;
  moduleId: string;
  importerId: string;
  /** File name or a short description of the source. */
  source: string;
  createdAt: number;
  /** Per collection the ids written by this batch. */
  records: { collection: string; ids: string[] }[];
  undoneAt?: number;
  /** Records skipped by the undo because they had been edited since. */
  keptOnUndo?: number;
}
