/** Device-local "seen" bookkeeping for the changelog (`_meta`; never synced, no changelog text stored). */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

const SEEN_KEY = 'changelog.seen';
const HINT_KEY = 'changelog.hint';

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function loadSeen(database: TaschenmesserDB = defaultDb): Promise<string[]> {
  const v = (await meta(database).get(SEEN_KEY))?.value;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export async function markSeen(
  version: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const seen = await loadSeen(database);
  if (seen.includes(version)) return;
  await meta(database).put({ key: SEEN_KEY, value: [...seen, version].slice(-50) });
}

/** The quiet "new" mark is on by default; this is its off switch. */
export async function loadHint(database: TaschenmesserDB = defaultDb): Promise<boolean> {
  return (await meta(database).get(HINT_KEY))?.value !== false;
}
export async function saveHint(on: boolean, database: TaschenmesserDB = defaultDb): Promise<void> {
  await meta(database).put({ key: HINT_KEY, value: on });
}

/** Unread = the version has notes and was never opened here. Unreleased notes are never "unread". */
export const isUnread = (seen: string[], version: string | undefined): boolean =>
  !!version && version !== 'unreleased' && !seen.includes(version);
