/**
 * "Letzte Zugriffe": the last requests, device-local. Only when, which token (by name), method,
 * route pattern, module, status and a count – never the token, query values or any content.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { rwTransaction } from '@/core/db/tx';

export const LOG_SIZE = 50;
const KEY = 'localApi.log';

export interface AccessEntry {
  at: number;
  /** Token name at the time of the request (and its id, for "zuletzt benutzt"). */
  token: string;
  tokenId?: string;
  method: string;
  route: string;
  module?: string;
  status: number;
  count?: number;
}

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function loadLog(database: TaschenmesserDB = defaultDb): Promise<AccessEntry[]> {
  const value = (await meta(database).get(KEY))?.value;
  return Array.isArray(value) ? (value as AccessEntry[]) : [];
}

export async function appendLog(
  entry: AccessEntry,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await rwTransaction(database, [meta(database)], async () => {
    const next = [entry, ...(await loadLog(database))].slice(0, LOG_SIZE);
    await meta(database).put({ key: KEY, value: next });
  });
}

/** Time of the last request per token id (derived from the log). */
export function lastUsed(entries: readonly AccessEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) if (e.tokenId && !out.has(e.tokenId)) out.set(e.tokenId, e.at);
  return out;
}

export async function clearLog(database: TaschenmesserDB = defaultDb): Promise<void> {
  await meta(database).delete(KEY);
}

export function useAccessLog(): AccessEntry[] | undefined {
  return useLiveQuery(() => loadLog(), []);
}
