/**
 * Small device-local values in `_meta` (never synced, never in a backup) for modules, which may not
 * import the Dexie database themselves: remembered column mappings, rules of the bank import,
 * "already told" flags, a run's input hash. Keys are `<module>.<name>`; the value must be JSON-like.
 * The optional `database` lets tests run two devices side by side.
 */
import { db as defaultDb, type TaschenmesserDB } from './db';

const table = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function getMeta<T>(
  key: string,
  database: TaschenmesserDB = defaultDb,
): Promise<T | undefined> {
  return (await table(database).get(key))?.value as T | undefined;
}

export async function setMeta(
  key: string,
  value: unknown,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).put({ key, value });
}

export async function deleteMeta(
  key: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).delete(key);
}
