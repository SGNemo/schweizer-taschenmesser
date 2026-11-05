/**
 * Device-local key/value state in `_meta` (never synced, never in a backup): a run's input hash, a
 * dismissed hint, a device flag. Modules never import `db` themselves; they read and write through
 * these helpers (or through `useLiveQuery(() => readMeta(key))` for live values).
 */
import { db as defaultDb, type TaschenmesserDB } from './db';

const table = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function readMeta<T>(key: string, database: TaschenmesserDB = defaultDb): Promise<T | undefined> {
  return (await table(database).get(key))?.value as T | undefined;
}

export async function writeMeta(
  key: string,
  value: unknown,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).put({ key, value });
}

export async function deleteMeta(key: string, database: TaschenmesserDB = defaultDb): Promise<void> {
  await table(database).delete(key);
}
