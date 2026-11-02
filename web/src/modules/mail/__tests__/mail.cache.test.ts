// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import type { MailMessage, MailThreadSummary } from '@/core/mail/types';
import { cacheStats, clearMailCache, loadBody, loadThreads, saveBody, saveThreads } from '../cache';
import { bodyRepo, threadRepo } from '../repo';

const thread = (
  id: string,
  date: number,
  extra: Partial<MailThreadSummary> = {},
): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { name: 'Geheim Absender', email: 'secret-sender@example.org' },
  subject: `Geheimer Betreff ${id}`,
  snippet: 'Vorschau mit privatem Inhalt',
  date,
  unread: true,
  labelIds: ['INBOX', 'UNREAD'],
  hasAttachment: false,
  ...extra,
});

const message: MailMessage = {
  id: 'm1',
  threadId: 't1',
  from: { email: 'a@example.org' },
  to: [{ email: 'b@example.org' }],
  cc: [],
  subject: 'Geheimer Betreff',
  date: 1,
  labelIds: [],
  unread: false,
  text: 'Streng geheimer Mailtext',
  attachments: [],
  inline: [],
};

beforeEach(async () => {
  await db.table('mail_thread').clear();
  await db.table('mail_body').clear();
  await db.table('_outbox').clear();
});

describe('mail cache', () => {
  it('keeps sender, subject, preview and body only sealed in the stored rows', async () => {
    await saveThreads('google', [thread('t1', 5)]);
    await saveBody('google', message);
    const raw = JSON.stringify([
      await db.table('mail_thread').toArray(),
      await db.table('mail_body').toArray(),
    ]);
    for (const secret of [
      'Geheimer Betreff',
      'secret-sender',
      'Vorschau mit privatem',
      'Streng geheimer',
      'a@example.org',
    ])
      expect(raw).not.toContain(secret);
  });

  it('round-trips headers and bodies', async () => {
    await saveThreads('google', [
      thread('t1', 5),
      thread('t2', 9, { unread: false, labelIds: ['SENT'] }),
    ]);
    const all = await loadThreads('google');
    expect(all.map((t) => t.id)).toEqual(['t2', 't1']); // newest first
    expect(all[1]).toMatchObject({ subject: 'Geheimer Betreff t1', unread: true, demo: false });
    expect((await loadThreads('google', { labelId: 'INBOX' })).map((t) => t.id)).toEqual(['t1']);
    expect(await loadThreads('other')).toEqual([]);
    await saveBody('google', message);
    expect(await loadBody('google', 'm1')).toEqual(message);
    expect(await loadBody('google', 'nope')).toBeUndefined();
  });

  it('reading seed rows never creates the device key (a write, forbidden in a live query)', async () => {
    await db.table('_secrets').clear();
    await threadRepo.create(
      {
        accountKey: 'demo',
        threadId: 'd1',
        sortKey: 1,
        unread: true,
        inbox: true,
        demo: {
          from: { email: 'x@example.org' },
          subject: 'Beispiel',
          snippet: '',
          messageCount: 1,
          hasAttachment: false,
          labelIds: ['INBOX'],
        },
      },
      { id: 'demo|d1' },
    );
    expect(await loadThreads('demo')).toHaveLength(1);
    expect(await db.table('_secrets').count()).toBe(0);
  });

  it('never queues anything for sync', async () => {
    await saveThreads('google', [thread('t1', 5)]);
    await saveBody('google', message);
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('does not show a row it can no longer open', async () => {
    await saveThreads('google', [thread('t1', 5)]);
    const row = (await threadRepo.active().toArray())[0]!;
    await threadRepo.update(row.id, { sealed: 'v1.broken.broken' });
    expect(await loadThreads('google')).toEqual([]);
  });

  it('keeps the newest 200 headers and 60 bodies per limit', async () => {
    await saveThreads(
      'google',
      Array.from({ length: 205 }, (_, i) => thread(`t${i}`, i + 1)),
    );
    const kept = await loadThreads('google');
    expect(kept).toHaveLength(200);
    expect(kept[0]!.id).toBe('t204');
    expect(kept.at(-1)!.id).toBe('t5');
    for (let i = 0; i < 62; i++) await saveBody('google', { ...message, id: `m${i}` });
    expect((await bodyRepo.active().toArray()).length).toBe(60);
  });

  it('clears one account or everything, but leaves the seed rows', async () => {
    await saveThreads('google', [thread('t1', 5)]);
    await saveThreads('google#a1', [thread('t9', 6)]);
    await saveBody('google', message);
    await threadRepo.create(
      {
        accountKey: 'demo',
        threadId: 'd1',
        sortKey: 1,
        unread: false,
        inbox: true,
        demo: {
          from: { email: 'x@example.org' },
          subject: 'Beispiel',
          snippet: '',
          messageCount: 1,
          hasAttachment: false,
          labelIds: ['INBOX'],
        },
      },
      { id: 'demo|d1' },
    );
    expect(await cacheStats()).toEqual({ threads: 2, bodies: 1 });
    await clearMailCache('google');
    expect(await cacheStats()).toEqual({ threads: 1, bodies: 0 });
    await clearMailCache();
    expect(await cacheStats()).toEqual({ threads: 0, bodies: 0 });
    expect(await loadThreads('demo')).toHaveLength(1);
  });
});
