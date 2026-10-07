/**
 * One-time third-party notices at the place of use ("Verstanden"): before the first cloud-AI call, when a connector is
 * connected, when the supporter area is opened. What was acknowledged is device-local (`_meta`, key `legal.notices`):
 * notice ids only, never synced, never in a backup. Without a mounted `NoticeHost` (tests, headless code) nothing blocks.
 */
import { z } from 'zod';
import { create } from 'zustand';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';

export const NOTICE_IDS = ['cloud-ai', 'connector-google', 'connector-ics', 'supporter'] as const;
export type NoticeId = (typeof NOTICE_IDS)[number];

export const NOTICES_KEY = 'legal.notices';
const schema = z.object({ seen: z.array(z.string()) });

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

async function readSeen(database: TaschenmesserDB): Promise<string[]> {
  const parsed = schema.safeParse((await meta(database).get(NOTICES_KEY))?.value);
  return parsed.success ? parsed.data.seen : [];
}

export async function hasSeenNotice(
  id: NoticeId,
  database: TaschenmesserDB = defaultDb,
): Promise<boolean> {
  return (await readSeen(database)).includes(id);
}

export async function acknowledgeNotice(
  id: NoticeId,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const seen = await readSeen(database);
  if (seen.includes(id)) return;
  await meta(database).put({ key: NOTICES_KEY, value: { seen: [...seen, id] } });
}

/** The notice the host shows now (first in the queue), `undefined` when none. */
export const useNoticeStore = create<{ queue: NoticeId[] }>(() => ({ queue: [] }));

const waiting = new Map<NoticeId, (() => void)[]>();
let hosts = 0;

/** Called by `NoticeHost` while mounted. */
export function registerNoticeHost(): () => void {
  hosts += 1;
  return () => {
    hosts -= 1;
    if (hosts === 0) resolveAll();
  };
}

function resolveAll() {
  for (const resolvers of waiting.values()) resolvers.forEach((r) => r());
  waiting.clear();
  useNoticeStore.setState({ queue: [] });
}

/**
 * Resolves once the notice was acknowledged (at once when it already was). Shows the dialog if not. Never rejects:
 * a database problem must not stop the feature the notice belongs to.
 */
export async function requireNotice(
  id: NoticeId,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  if (hosts === 0) return;
  try {
    if (await hasSeenNotice(id, database)) return;
  } catch {
    return;
  }
  if (hosts === 0) return;
  await new Promise<void>((resolve) => {
    waiting.set(id, [...(waiting.get(id) ?? []), resolve]);
    useNoticeStore.setState((s) => (s.queue.includes(id) ? s : { queue: [...s.queue, id] }));
  });
}

/** The "Verstanden" click. */
export async function confirmNotice(
  id: NoticeId,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  try {
    await acknowledgeNotice(id, database);
  } catch {
    // not saved: the notice may show once more, the feature goes on
  }
  waiting.get(id)?.forEach((r) => r());
  waiting.delete(id);
  useNoticeStore.setState((s) => ({ queue: s.queue.filter((x) => x !== id) }));
}
