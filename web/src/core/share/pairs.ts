/**
 * Standing connections for "Mit Partner teilen": which modules, how far each direction has come.
 * Device-local (`_meta` key `share.pairs`, never synced, not in backups or diagnostics); the pairing
 * code lives in the platform secret store, never next to the data.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
import { randomDeviceId } from '@/core/db/util';
import { now } from '@/core/time/now';
import { newPairingCode, normalizeCode } from './share';

export interface SharePair {
  /** Random id shared by both sides (it travels in the clear in the file header). */
  id: string;
  /** What this device calls the other side. */
  name: string;
  modules: string[];
  /** Per module: only these lists are shared (`scopes.ts`); absent = the whole module. */
  lists?: Record<string, string[]>;
  createdAt: number;
  /** Newest stamp already handed over in a file this device saved. */
  sentUpto?: string;
  /** Newest stamp of the files this device opened. */
  receivedUpto?: string;
  sentAt?: number;
  receivedAt?: number;
}

const META_KEY = 'share.pairs';
const codeSecret = (id: string) => `share.code.${id}`;

export async function loadPairs(database: TaschenmesserDB = defaultDb): Promise<SharePair[]> {
  const row = await database
    .table<{ key: string; value: SharePair[] }, string>('_meta')
    .get(META_KEY);
  return Array.isArray(row?.value) ? row.value : [];
}

async function savePairs(pairs: SharePair[], database: TaschenmesserDB): Promise<void> {
  await database.table('_meta').put({ key: META_KEY, value: pairs });
}

export async function updatePair(
  id: string,
  patch: Partial<Omit<SharePair, 'id'>>,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const pairs = await loadPairs(database);
  await savePairs(
    pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    database,
  );
}

/** A new connection on this side: returns the code to tell the other person. */
export async function createPair(
  input: { name: string; modules: string[]; lists?: Record<string, string[]> },
  database: TaschenmesserDB = defaultDb,
): Promise<{ pair: SharePair; code: string }> {
  const code = await newPairingCode();
  const pair: SharePair = {
    id: randomDeviceId(),
    name: input.name.trim() || '?',
    modules: input.modules,
    ...(input.lists ? { lists: input.lists } : {}),
    createdAt: now(),
  };
  await savePairs([...(await loadPairs(database)), pair], database);
  await getPlatform().secrets.set(codeSecret(pair.id), code);
  return { pair, code };
}

/** The other side's first file arrived: remember the connection under the same id. */
export async function joinPair(
  input: { id: string; name: string; modules: string[]; code: string },
  database: TaschenmesserDB = defaultDb,
): Promise<SharePair> {
  const pairs = await loadPairs(database);
  const existing = pairs.find((p) => p.id === input.id);
  if (existing) return existing;
  const pair: SharePair = {
    id: input.id,
    name: input.name.trim() || '?',
    modules: input.modules,
    createdAt: now(),
  };
  await savePairs([...pairs, pair], database);
  await getPlatform().secrets.set(codeSecret(pair.id), normalizeCode(input.code));
  return pair;
}

export const pairCode = (id: string): Promise<string | undefined> =>
  getPlatform().secrets.get(codeSecret(id));

export async function removePair(id: string, database: TaschenmesserDB = defaultDb): Promise<void> {
  await savePairs(
    (await loadPairs(database)).filter((p) => p.id !== id),
    database,
  );
  await getPlatform().secrets.delete(codeSecret(id));
}
