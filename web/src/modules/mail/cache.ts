/**
 * The mail cache: only what the screens need (thread headers for the lists, opened messages), sealed
 * with the device key, local to this device, bounded and deletable. Nothing here is synced or backed up.
 */
import { openJson, sealJson } from '@/core/crypto/aead';
import { getDeviceKey } from '@/core/secrets/deviceKey';
import { now } from '@/core/time/now';
import type { MailMessage, MailThreadSummary } from '@/core/mail/types';
import { bodyRepo, threadRepo } from './repo';
import { threadMetaSchema, type ThreadMeta } from './schema';

export const DEMO_ACCOUNT = 'demo';
const MAX_THREADS = 200;
const MAX_BODIES = 60;

const threadId = (accountKey: string, id: string) => `${accountKey}|${id}`;

export async function saveThreads(accountKey: string, threads: MailThreadSummary[]): Promise<void> {
  if (threads.length === 0) return;
  const key = await getDeviceKey();
  for (const t of threads) {
    const id = threadId(accountKey, t.id);
    const meta: ThreadMeta = {
      from: t.from,
      subject: t.subject,
      snippet: t.snippet,
      messageCount: t.messageCount,
      hasAttachment: t.hasAttachment,
      labelIds: t.labelIds,
    };
    await threadRepo.upsert(id, {
      accountKey,
      threadId: t.id,
      sortKey: t.date,
      unread: t.unread,
      inbox: t.labelIds.includes('INBOX'),
      sealed: await sealJson(key, id, meta),
    });
  }
  await trim(accountKey);
}

/** Keeps the newest `MAX_THREADS` headers per account. */
async function trim(accountKey: string): Promise<void> {
  const rows = await threadRepo
    .active()
    .filter((r) => r.accountKey === accountKey)
    .toArray();
  if (rows.length <= MAX_THREADS) return;
  rows.sort((a, b) => b.sortKey - a.sortKey);
  await threadRepo.purge(rows.slice(MAX_THREADS).map((r) => r.id));
}

export interface CachedThreadView extends MailThreadSummary {
  /** True for seed rows (invented mails). */
  demo: boolean;
}

/** Cached headers of an account, newest first; optionally only those carrying a label. */
export async function loadThreads(
  accountKey: string,
  opts: { labelId?: string; limit?: number } = {},
): Promise<CachedThreadView[]> {
  const rows = await threadRepo
    .active()
    .filter((r) => r.accountKey === accountKey)
    .toArray();
  rows.sort((a, b) => b.sortKey - a.sortKey);
  // The key is only fetched for a sealed row: it exists by then, so this stays a plain read (this
  // function also runs inside a Dexie live query, where creating the key would be a forbidden write).
  let key: CryptoKey | undefined;
  const out: CachedThreadView[] = [];
  for (const r of rows) {
    let meta: ThreadMeta | undefined = r.demo;
    if (!meta && r.sealed) {
      try {
        key ??= await getDeviceKey();
        meta = threadMetaSchema.parse(await openJson(key, r.id, r.sealed));
      } catch {
        continue; // sealed with a key this device no longer has: unreadable, so not shown
      }
    }
    if (!meta) continue;
    if (opts.labelId && !meta.labelIds.includes(opts.labelId)) continue;
    out.push({
      id: r.threadId,
      date: r.sortKey,
      unread: r.unread,
      ...meta,
      demo: r.demo !== undefined,
    });
    if (opts.limit && out.length >= opts.limit) break;
  }
  return out;
}

export async function saveBody(accountKey: string, message: MailMessage): Promise<void> {
  const id = threadId(accountKey, message.id);
  const key = await getDeviceKey();
  await bodyRepo.upsert(id, {
    accountKey,
    messageId: message.id,
    threadId: message.threadId,
    sortKey: now(),
    sealed: await sealJson(key, id, message),
  });
  const rows = await bodyRepo.active().toArray();
  if (rows.length > MAX_BODIES) {
    rows.sort((a, b) => b.sortKey - a.sortKey);
    await bodyRepo.purge(rows.slice(MAX_BODIES).map((r) => r.id));
  }
}

export async function loadBody(
  accountKey: string,
  messageId: string,
): Promise<MailMessage | undefined> {
  const id = threadId(accountKey, messageId);
  const row = await bodyRepo.get(id);
  if (!row) return undefined;
  if (row.demo)
    return {
      id: row.messageId,
      threadId: row.threadId,
      from: row.demo.from,
      to: row.demo.to,
      cc: [],
      subject: row.demo.subject,
      date: row.demo.date,
      labelIds: [],
      unread: false,
      text: row.demo.text,
      html: row.demo.html,
      attachments: [],
      inline: [],
    };
  if (!row.sealed) return undefined;
  try {
    return (await openJson(await getDeviceKey(), id, row.sealed)) as MailMessage;
  } catch {
    return undefined;
  }
}

export async function cacheStats(): Promise<{ threads: number; bodies: number }> {
  const [threads, bodies] = await Promise.all([
    threadRepo
      .active()
      .filter((r) => r.demo === undefined)
      .count(),
    bodyRepo
      .active()
      .filter((r) => r.demo === undefined)
      .count(),
  ]);
  return { threads, bodies };
}

/** Deletes cached mail (all accounts, or one). Seed rows stay. */
export async function clearMailCache(accountKey?: string): Promise<void> {
  const mine = <T extends { accountKey: string; demo?: unknown }>(r: T) =>
    r.demo === undefined && (accountKey === undefined || r.accountKey === accountKey);
  const threads = await threadRepo.table.toCollection().filter(mine).primaryKeys();
  const bodies = await bodyRepo.table.toCollection().filter(mine).primaryKeys();
  await threadRepo.purge(threads as string[]);
  await bodyRepo.purge(bodies as string[]);
}

/** Cached bodies of one thread (seed rows and opened messages), oldest first. */
export async function loadThreadBodies(accountKey: string, thread: string): Promise<MailMessage[]> {
  const rows = await bodyRepo
    .active()
    .filter((r) => r.accountKey === accountKey && r.threadId === thread)
    .toArray();
  const out: MailMessage[] = [];
  for (const r of rows) {
    const m = await loadBody(accountKey, r.messageId);
    if (m) out.push(m);
  }
  return out.sort((a, b) => a.date - b.date);
}
