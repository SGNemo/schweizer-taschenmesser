import type { TaschenmesserDB } from '@/core/db/db';
import type { CalendarItem, ModuleManifest } from '@/core/modules/types';
import type { PreparedOp, Stage } from '../write/types';

export type AiQueryErrorCode =
  | 'unknown-module'
  | 'inactive-module'
  | 'unknown-collection'
  | 'unknown-field'
  | 'bad-operator'
  | 'bad-value'
  | 'no-date-field'
  | 'bad-aggregate'
  | 'unknown-computed'
  | 'unknown-action'
  | 'invalid-entry';

/** A rejected intent: the model (or parser) asked for something the schemas do not allow. */
export class AiQueryError extends Error {
  constructor(
    readonly code: AiQueryErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'AiQueryError';
  }
}

export interface ResultRow {
  id: string;
  title: string;
  /** e.g. "Rechnung · Rechnungen" for search hits. */
  subtitle?: string;
  fields: { label: string; value: string }[];
  /** Route that shows the entry. */
  to?: string;
}

export interface PreparedCreate {
  module: string;
  moduleName: string;
  collection: string;
  /** German label of the collection, e.g. "Erinnerung". */
  label: string;
  /** Fully validated record data (defaults applied), ready for the module repo. */
  data: Record<string, unknown>;
  preview: { label: string; value: string }[];
}

export type AiResult =
  | { kind: 'rows'; heading: string; rows: ResultRow[]; total: number }
  | { kind: 'aggregate'; heading: string; value: string; note?: string }
  | { kind: 'agenda'; from: string; to: string; items: CalendarItem[] }
  | { kind: 'computed'; title: string; lines: { label: string; value: string }[] }
  | { kind: 'create'; prepared: PreparedCreate }
  | { kind: 'write'; stage: Stage; ops: PreparedOp[]; confidence: number; question?: string }
  | { kind: 'message'; text: string };

export interface ExecContext {
  /** Manifests of the enabled modules – the only data the assistant may touch. */
  manifests: readonly ModuleManifest[];
  /** All known modules, to tell "disabled" apart from "does not exist". */
  known: readonly ModuleManifest[];
  database: TaschenmesserDB;
  today: string;
}
