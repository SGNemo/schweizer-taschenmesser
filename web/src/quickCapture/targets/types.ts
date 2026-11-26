import type { Repo } from '@/core/db/repo';
import type { CaptureFields, CaptureType } from '../parser';

/** What an adapter needs besides the parsed fields. */
export interface BuildContext {
  /** Today's local date, 'YYYY-MM-DD'. */
  today: string;
}

/** What `amend` gets: the date of the line and the target collection's repo (the adapter stays module-free). */
export interface AmendContext extends BuildContext {
  repo: Repo<Record<string, unknown>>;
}

/** An open invoice a payment reminder belongs to (`findOpenInvoice`). */
export interface OpenInvoice {
  id: string;
  payee: string;
  /** 'YYYY-MM-DD'. */
  dueDate: string;
  /** What is still open: amount minus part payments, cents. */
  restMinor: number;
}

/** The record a first stage wrote (module + id), handed to the second stage. */
export interface CaptureRef {
  moduleId: string;
  id: string;
}

/**
 * The second stage of a two-stage save (`plan`): the entry itself is written by the target of type
 * `type` (a ToDo through the `todo` target), then this target's own record is written through its
 * manifest repo under `id(first)` – a deterministic id that names the first record (`todos:<id>`), so
 * it is an `upsert`, never a second random row. `SavedCapture.undo` removes both.
 */
export interface CaptureVia {
  type: CaptureType;
  id(first: CaptureRef): string;
}

/** Which word a field of the edit panel carries (`t.quickCapture.field`). */
export type CaptureFieldLabel =
  | 'title'
  | 'payee'
  | 'name'
  | 'amount'
  | 'due'
  | 'date'
  | 'time'
  | 'when'
  | 'reference'
  | 'rhythm'
  | 'duration'
  | 'deadline'
  | 'start'
  | 'birthday'
  | 'url'
  | 'kcal';

/**
 * One field the sheet can show for a target (the mail dialog's edit panel). `required` mirrors what
 * `build` rejects without it, so the panel names the missing field before a save fails (`targets.test.ts`
 * pins both against each other).
 */
export interface CaptureFieldSpec {
  key:
    | 'title'
    | 'amountMinor'
    | 'date'
    | 'time'
    | 'reference'
    | 'recurrence'
    | 'estimateMin'
    | 'url'
    | 'kcal';
  input: 'text' | 'money' | 'day' | 'time' | 'rhythm' | 'minutes' | 'number';
  label: CaptureFieldLabel;
  required?: boolean;
  /** Written along when the field holds a value (a plan's day as a hard deadline). */
  with?: Partial<CaptureFields>;
}

/**
 * One capture destination. Adapters know the field names of a module's public collection and
 * nothing else: they never import module code, they write through the manifest + `createRepo`.
 */
export interface CaptureTarget {
  type: CaptureType;
  moduleId: string;
  collection: string;
  /** Finance drafts are only booked after an explicit confirmation. */
  requiresConfirm?: boolean;
  /** The fields the edit panel shows for this target, in order (empty: the line alone says it all). */
  fields: readonly CaptureFieldSpec[];
  /**
   * Maps parsed fields to the raw record. Throws `CaptureError('invalid')` for unusable input. A
   * two-stage target gets the first record in `first` (absent while the form only checks the input).
   */
  build(fields: CaptureFields, ctx: BuildContext, first?: CaptureRef): Record<string, unknown>;
  /** Two-stage save: the entry is written by another target first (see `CaptureVia`). */
  via?: CaptureVia;
  /**
   * At most `count` live rows in the collection: `saveCapture` counts before writing and throws
   * `CaptureError('full', text())` (the clock's 12 places).
   */
  maxActive?: { count: number; text: () => string };
  /**
   * Notes something on an existing record instead of creating one (a payment reminder on its open
   * invoice). Re-reads the record and throws `CaptureError('stale')` when it is gone or settled; the
   * returned `undo` takes back only what it wrote and never removes the record.
   */
  amend?(fields: CaptureFields, match: OpenInvoice, ctx: AmendContext): Promise<SavedCapture>;
  /**
   * Writes the entry into an existing row instead of creating one (a break appended to the planner's day row,
   * created when missing). `saveCapture` calls it instead of the create; the returned `undo` takes back only
   * what it wrote.
   */
  save?(fields: CaptureFields, ctx: AmendContext): Promise<SavedCapture>;
  /**
   * The thing the planner lists for a saved record when it is not the record itself (a shopping-list entry: its
   * list). Read from the written data; `SavedCapture.planRef` carries it.
   */
  planRef?(data: Record<string, unknown>): CaptureRef | undefined;
}

export type CaptureErrorCode =
  | 'module-off'
  | 'invalid'
  | 'unknown-target'
  | 'currency'
  /** `amend`: the record is gone or settled since the preview. */
  | 'stale'
  /** `maxActive`: the collection is full; `detail` is the sentence to show. */
  | 'full';

export class CaptureError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    /** Module name for `module-off`, currency code for `currency`, the text for `full`. */
    readonly detail?: string,
  ) {
    super(code);
  }
}

export interface SavedCapture {
  id: string;
  type: CaptureType;
  moduleId: string;
  /** Soft-deletes the record again (tombstone, syncs like any delete). */
  undo(): Promise<void>;
  /** Several entries saved at once (multi-line capture): how many; `undo` removes all of them. */
  count?: number;
  /** The text they came from, so "Ändern" can put it back into the form. */
  text?: string;
  /** Every entry's type in a multi-line save (a reminder among them asks for alerts, C01). */
  types?: CaptureType[];
  /**
   * A save with a fixed id found the record already there: `true` live, `'tombstone'` deleted. Nothing
   * was written (neither stage) and `undo` does nothing. Also `true` for an `amend` that was already noted.
   */
  existed?: true | 'tombstone';
  /** The entry noted something on an existing record (`amend`) instead of creating one. */
  amended?: boolean;
  /** The thing the planner lists for it when that is not the record itself (`CaptureTarget.planRef`). */
  planRef?: CaptureRef;
}
