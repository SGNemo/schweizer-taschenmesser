/** Device-local engine state in `_meta` (never synced). */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

const table = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function readKv<T>(database: TaschenmesserDB, key: string): Promise<T | undefined> {
  return (await table(database).get(key))?.value as T | undefined;
}

export async function writeKv(
  database: TaschenmesserDB,
  key: string,
  value: unknown,
): Promise<void> {
  await table(database).put({ key, value });
}

export { defaultDb };
