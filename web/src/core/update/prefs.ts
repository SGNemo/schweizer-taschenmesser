/** Device-local update preferences and bookkeeping (`_meta`; never synced). */
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import type { UpdateChannel } from './types';

const PREFS_KEY = 'update.prefs';
const LAST_CHECK_KEY = 'update.lastCheckAt';
const DISMISSED_KEY = 'update.dismissedVersion';

export const prefsSchema = z.object({
  channel: z.enum(['stable', 'beta']).default('stable'),
  auto: z.boolean().default(true),
});
export interface UpdatePrefs {
  channel: UpdateChannel;
  auto: boolean;
}

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function loadPrefs(database: TaschenmesserDB = defaultDb): Promise<UpdatePrefs> {
  const row = await meta(database).get(PREFS_KEY);
  const parsed = prefsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : prefsSchema.parse({});
}

export async function savePrefs(
  patch: Partial<UpdatePrefs>,
  database: TaschenmesserDB = defaultDb,
): Promise<UpdatePrefs> {
  const next = { ...(await loadPrefs(database)), ...patch };
  await meta(database).put({ key: PREFS_KEY, value: next });
  return next;
}

async function read<T>(database: TaschenmesserDB, key: string): Promise<T | undefined> {
  return (await meta(database).get(key))?.value as T | undefined;
}

export const getLastCheckAt = (database: TaschenmesserDB = defaultDb) =>
  read<number>(database, LAST_CHECK_KEY);
export const setLastCheckAt = (at: number, database: TaschenmesserDB = defaultDb) =>
  meta(database).put({ key: LAST_CHECK_KEY, value: at });

/** The version the user postponed with "Später": not offered again automatically. */
export const getDismissedVersion = (database: TaschenmesserDB = defaultDb) =>
  read<string>(database, DISMISSED_KEY);
export const setDismissedVersion = (
  version: string | undefined,
  database: TaschenmesserDB = defaultDb,
) =>
  version === undefined
    ? meta(database).delete(DISMISSED_KEY)
    : meta(database).put({ key: DISMISSED_KEY, value: version });
