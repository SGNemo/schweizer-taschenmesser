/**
 * Cache of *structured intents* (not results): the same question on the same day with the same
 * schema and model costs no tokens the second time, and the answer is still computed from live data.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { now } from '@/core/time/now';
import { intentSchema, type Intent } from './query/schema';
import { fold } from './text';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheRow {
  key: string;
  intent: unknown;
  createdAt: number;
}

const table = (database: TaschenmesserDB) => database.table<CacheRow, string>('_aiCache');

export const normalizeQuestion = (q: string): string =>
  fold(q)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export async function cacheKey(parts: {
  question: string;
  today: string;
  schemaHash: string;
  provider: string;
  model: string;
}): Promise<string> {
  const text = [
    normalizeQuestion(parts.question),
    parts.today,
    parts.schemaHash,
    parts.provider,
    parts.model,
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getCachedIntent(
  key: string,
  database: TaschenmesserDB = defaultDb,
): Promise<Intent | undefined> {
  const row = await table(database).get(key);
  if (!row || now() - row.createdAt > TTL_MS) return undefined;
  const parsed = intentSchema.safeParse(row.intent);
  return parsed.success ? parsed.data : undefined;
}

export async function putCachedIntent(
  key: string,
  intent: Intent,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).put({ key, intent, createdAt: now() });
  await table(database)
    .where('createdAt')
    .below(now() - TTL_MS)
    .delete();
}

export const clearAiCache = (database: TaschenmesserDB = defaultDb): Promise<void> =>
  table(database).clear();
