// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import * as service from '@/core/mail/service';
import type { MailThreadSummary } from '@/core/mail/types';
import { saveThreads } from '../cache';
import target from '../linkTarget';
import { threadRepo } from '../repo';

const thread = (id: string): MailThreadSummary => ({
  id,
  messageCount: 1,
  from: { name: 'Stadtwerke', email: 'rechnung@stadtwerke.example' },
  subject: 'Ihre Rechnung',
  snippet: 'Vorschau',
  date: 1,
  unread: false,
  labelIds: ['INBOX'],
  hasAttachment: false,
});

beforeEach(async () => {
  for (const t of ['mail_thread', '_secrets', '_meta']) await db.table(t).clear();
});
afterEach(() => vi.restoreAllMocks());

describe('mail threads as a link target', () => {
  it('alive: a thread in this device’s cache, with its subject and the in-app route', async () => {
    await saveThreads('acc-1', [thread('18c2a_b-9')]);
    expect(await target.resolve('18c2a_b-9')).toEqual({
      state: 'alive',
      title: 'Ihre Rechnung',
      to: '/mail?open=18c2a_b-9',
    });
  });

  it('elsewhere: a thread that is not cached here – the web address, no request, no account in it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const url = vi
      .spyOn(service, 'mailThreadUrl')
      .mockImplementation((id) => `https://mail.example/#all/${id}`);
    expect(await target.resolve('18c2a')).toEqual({
      state: 'elsewhere',
      url: 'https://mail.example/#all/18c2a',
    });
    expect(url).toHaveBeenCalledWith('18c2a');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('elsewhere without an address when no provider can build one; a removed cache row counts as not here', async () => {
    vi.spyOn(service, 'mailThreadUrl').mockReturnValue(undefined);
    await saveThreads('acc-1', [thread('t1')]);
    await threadRepo.remove('acc-1|t1');
    expect(await target.resolve('t1')).toEqual({ state: 'elsewhere' });
  });

  it('gone: a malformed id never reaches the cache or an address', async () => {
    const url = vi.spyOn(service, 'mailThreadUrl');
    for (const raw of ['', 'a b', '../x', 'id?authuser=me@example.org', 'x'.repeat(129)])
      expect(await target.resolve(raw)).toEqual({ state: 'gone' });
    expect(url).not.toHaveBeenCalled();
  });
});
