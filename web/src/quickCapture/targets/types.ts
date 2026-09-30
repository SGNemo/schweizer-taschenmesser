import type { CaptureFields, CaptureType } from '../parser';

/** What an adapter needs besides the parsed fields. */
export interface BuildContext {
  /** Today's local date, 'YYYY-MM-DD'. */
  today: string;
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
  /** Maps parsed fields to the raw record. Throws `CaptureError('invalid')` for unusable input. */
  build(fields: CaptureFields, ctx: BuildContext): Record<string, unknown>;
}

export type CaptureErrorCode = 'module-off' | 'invalid' | 'unknown-target';

export class CaptureError extends Error {
  constructor(
    readonly code: CaptureErrorCode,
    /** Module name for `module-off`. */
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
}
