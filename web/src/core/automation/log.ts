/** The rule log (`_automationLog`, device-local): one row per run, dry run or noteworthy skip. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { HOUR_MS, type Refusal } from './guards';
import type { ActionKind } from './types';

export const LOG_MAX_ROWS = 500;
export const LOG_MAX_AGE_MS = 30 * 24 * HOUR_MS;

export interface ActionOutcome {
  kind: ActionKind;
  ok: boolean;
  /** A short code (`dry`, `exists`, `busy`, `incomplete`, `not-allowed`, `module-unavailable`, an error code), never user data. */
  note?: string;
  module?: string;
  written?: number;
}

export interface LogRow {
  id?: number;
  at: number;
  ruleId: string;
  ruleTitle: string;
  /** Event type that fired the rule. */
  trigger: string;
  eventKey: string;
  /** Title of the thing that triggered it – a title only, never more. */
  eventTitle?: string;
  result: 'done' | 'dry' | 'skipped' | 'error';
  reason?: Refusal;
  dryRun: boolean;
  /** Everything this run wrote shares this id; "Rückgängig" takes it. */
  groupId?: string;
  actions: ActionOutcome[];
  undone?: boolean;
}

const table = (database: TaschenmesserDB) => database.table<LogRow, number>('_automationLog');

export async function appendLog(
  row: Omit<LogRow, 'id'>,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const t = table(database);
  await t.add(row as LogRow);
  const count = await t.count();
  if (count > LOG_MAX_ROWS) {
    const extra = await t
      .orderBy('id')
      .limit(count - LOG_MAX_ROWS)
      .primaryKeys();
    await t.bulkDelete(extra);
  }
}

export async function pruneLog(at: number, database: TaschenmesserDB = defaultDb): Promise<void> {
  await table(database)
    .where('at')
    .below(at - LOG_MAX_AGE_MS)
    .delete();
}

/** Newest first. */
export const listLog = (limit = 100, database: TaschenmesserDB = defaultDb): Promise<LogRow[]> =>
  table(database).orderBy('id').reverse().limit(limit).toArray();

export const useAutomationLog = (limit = 100): LogRow[] | undefined =>
  useLiveQuery(() => listLog(limit), [limit]);

export async function markUndone(
  groupId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).where('groupId').equals(groupId).modify({ undone: true });
}
