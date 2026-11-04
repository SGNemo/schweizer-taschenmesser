/** Device-local "seen" bookkeeping for the changelog (`_meta`; never synced, no changelog text stored). */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

const SEEN_KEY = 'changelog.seen';
const HINT_KEY = 'changelog.hint';
/** Fired after a version was marked seen / the switch changed, so the dots update at once. */
export const SEEN_EVENT = 'nemo:changelog-seen';

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
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SEEN_EVENT));
}

/** The quiet "new" mark is on by default; this is its off switch. */
export async function loadHint(database: TaschenmesserDB = defaultDb): Promise<boolean> {
  return (await meta(database).get(HINT_KEY))?.value !== false;
}
export async function saveHint(on: boolean, database: TaschenmesserDB = defaultDb): Promise<void> {
  await meta(database).put({ key: HINT_KEY, value: on });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SEEN_EVENT));
}

/**
 * Unread = the token (a version, or `unreleased:<hash>` of the open notes in a preview) was never
 * opened here. The bare word `unreleased` is not a token.
 */
export const isUnread = (seen: string[], token: string | undefined): boolean =>
  !!token && token !== 'unreleased' && !seen.includes(token);
