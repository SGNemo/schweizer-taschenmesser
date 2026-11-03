/**
 * What rules leave for the user: reminders and hints (shown by the notification centre through
 * `collectDue`, always soft so quiet hours, mute and the hourly limit apply) and suggestions (entries
 * waiting for a confirmation). Device-local in `_meta`; titles stay on this device (`local`).
 */
import type { ProposedOp } from '@/core/ai/write/types';
import type { TaschenmesserDB } from '@/core/db/db';
import type { DueNotification } from '@/core/modules/types';
import { readKv, writeKv, defaultDb } from './kv';

const KEY = 'automation.notices';
const MAX = 50;
const KEEP_MS = 7 * 24 * 3_600_000;

export interface AutomationNotice {
  id: string;
  groupId: string;
  ruleId: string;
  at: number;
  title: string;
  body?: string;
  url?: string;
  /** A suggestion waits behind this notice. */
  suggestion?: ProposedOp;
}

export const noticeKey = (n: Pick<AutomationNotice, 'id'>): string => `auto-${n.id}`;

export async function listNotices(
  database: TaschenmesserDB = defaultDb,
): Promise<AutomationNotice[]> {
  return (await readKv<AutomationNotice[]>(database, KEY)) ?? [];
}

export async function addNotice(
  notice: AutomationNotice,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const list = (await listNotices(database)).filter((n) => n.id !== notice.id);
  await writeKv(database, KEY, [...list, notice].slice(-MAX));
}

export async function removeNotices(
  match: { groupId?: string; id?: string },
  database: TaschenmesserDB = defaultDb,
): Promise<number> {
  const list = await listNotices(database);
  const keep = list.filter((n) => !(n.groupId === match.groupId || n.id === match.id));
  if (keep.length !== list.length) await writeKv(database, KEY, keep);
  return list.length - keep.length;
}

export async function pruneNotices(
  at: number,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const list = await listNotices(database);
  const keep = list.filter((n) => n.at > at - KEEP_MS);
  if (keep.length !== list.length) await writeKv(database, KEY, keep);
}

/** The notice source for `collectDue`. */
export async function automationDue(
  range: { from: number; to: number },
  database: TaschenmesserDB = defaultDb,
): Promise<DueNotification[]> {
  const list = await listNotices(database);
  return list
    .filter((n) => n.at > range.from && n.at <= range.to)
    .map((n) => ({
      key: noticeKey(n),
      at: n.at,
      title: n.title,
      ...(n.body ? { body: n.body } : {}),
      ...(n.url ? { url: n.url } : {}),
      soft: true,
      local: true as const,
    }));
}
