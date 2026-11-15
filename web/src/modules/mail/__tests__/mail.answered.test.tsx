// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { createCollectionRepo } from '@/core/db/repo';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { emptyNotifyState } from '@/core/mail/notify';
import type { MailAccountRef, MailPage, MailThreadSummary } from '@/core/mail/types';
import { disableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';

// „Wochenende retten“ F5 (b): the device-local „last message is mine“ flag and „Beantwortet? · Erledigt“.
// Invented data only.
let listed: MailPage = { threads: [] };
vi.mock('@/core/mail/service', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  mailThreads: async () => listed,
}));

import { answeredRows, closeAnswered } from '../answered';
import { loadThreads, saveThreads } from '../cache';
import { defaultDeps, pollAll } from '../notifyService';
import { openPlans, planMail, planMailId } from '../planMail';
import { settings, type MailSettings } from '../settings';
import { useMailbox } from '../useMailbox';

const account: MailAccountRef = {
  key: 'google#a1',
  connectorId: 'google',
  email: 'me@example.org',
  features: ['mail'],
};

const summary = (id: string, last: string[], union = last): MailThreadSummary => ({
  id,
  messageCount: 2,
  from: { name: 'Lisa Beispiel', email: 'lisa@example.org' },
  subject: 'Umzugshilfe am Sonntag?',
  snippet: 'Klar, ich bin da.',
  date: new Date(2026, 8, 29, 20, 5).getTime(),
  unread: false,
  labelIds: union,
  hasAttachment: false,
  lastMessageId: `${id}-2`,
  lastLabelIds: last,
});

const mine = summary('t-mine', ['SENT'], ['INBOX', 'SENT']);
// An older reply of one's own, but the newest message is hers: the union has SENT, the flag must not.
const theirs = summary('t-theirs', ['INBOX'], ['INBOX', 'SENT']);

const flags = async () =>
  Object.fromEntries(
    (await loadThreads(account.key)).map((th) => [th.id, th.lastFromMe ?? false] as const),
  );
const taskRepo = () => createCollectionRepo(getManifest('todos')!, 'task');
const lastToast = () => useUiStore.getState().toasts.at(-1);

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
  bus.clear();
  listed = { threads: [] };
  useUiStore.setState({ toasts: [] });
  await disableModule(getManifest('planner')!, 'keep');
});
afterEach(() => {
  setNow();
  bus.clear();
});

describe('the flag (device-local mail cache only)', () => {
  it('comes from the newest message only, and only on the list path', async () => {
    await saveThreads(account.key, [mine, theirs], { list: true });
    expect(await flags()).toEqual({ 't-mine': true, 't-theirs': false });
    await saveThreads(account.key, [mine, theirs]);
    expect(await flags()).toEqual({ 't-mine': false, 't-theirs': false });
  });

  it('is never written by the background check (`pollAll` → `saveHeaders`)', async () => {
    const real = defaultDeps();
    expect(real.saveHeaders).toBe(saveThreads);
    const deps = {
      ...real,
      settings: async () => ({ ...(settings.defaults as unknown as MailSettings), notify: true }),
      accounts: async () => [account],
      threads: async () => ({ threads: [mine] }),
      load: async () => emptyNotifyState(),
      save: async () => undefined,
    };
    expect(await pollAll(deps)).toBe(1);
    expect(await flags()).toEqual({ 't-mine': false });
    // A flag the list wrote is dropped by the background refresh (never set, never kept stale).
    await saveThreads(account.key, [mine], { list: true });
    await pollAll(deps);
    expect(await flags()).toEqual({ 't-mine': false });
  });

  it('is set when the person opens the list (`useMailbox`), on the fetched rows and in the cache', async () => {
    listed = { threads: [mine, theirs] };
    const { result } = renderHook(() => useMailbox(account, 'INBOX', ''));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.threads.map((th) => [th.id, th.lastFromMe ?? false])).toEqual([
      ['t-mine', true],
      ['t-theirs', false],
    ]);
    expect(await flags()).toEqual({ 't-mine': true, 't-theirs': false });
  });
});

describe('„Beantwortet? · Erledigt“', () => {
  it('asks only for an open ToDo from the mail with the newest message mine, and only with the setting on', async () => {
    await planMail(account, { id: mine.id, from: mine.from, subject: mine.subject }, () => {});
    await planMail(
      account,
      { id: theirs.id, from: theirs.from, subject: theirs.subject },
      () => {},
    );
    await saveThreads(account.key, [mine, theirs], { list: true });
    const rows = await loadThreads(account.key);
    const open = await openPlans(account.key);
    expect([...answeredRows(rows, open, true)]).toEqual([['t-mine', await planMailId('t-mine')]]);
    expect(answeredRows(rows, open, false).size).toBe(0);
    // Done (or deleted) ToDos ask nothing.
    await taskRepo().update(await planMailId('t-mine'), { done: true });
    expect(answeredRows(rows, await openPlans(account.key), true).size).toBe(0);
  });

  it('leaves the synced ToDo exactly as planned: no new field from the flag', async () => {
    await planMail(account, { id: mine.id, from: mine.from, subject: mine.subject }, () => {});
    await planMail(
      account,
      { id: theirs.id, from: theirs.from, subject: theirs.subject },
      () => {},
    );
    const id = await planMailId('t-mine');
    const before = await db.table('todos_task').get(id);
    await saveThreads(account.key, [mine, theirs], { list: true });
    const after = await db.table('todos_task').get(id);
    expect(after).toEqual(before);
    // The same fields as a ToDo from a mail that was not answered.
    const other = await db.table('todos_task').get(await planMailId('t-theirs'));
    expect(Object.keys(after).sort()).toEqual(Object.keys(other).sort());
    expect(JSON.stringify(after)).not.toMatch(/lastFromMe|SENT|answer/i);
  });

  it('„Erledigt“ sends only the ToDo id over the bus; the toast takes it back', async () => {
    await planMail(account, { id: mine.id, from: mine.from, subject: mine.subject }, () => {});
    const id = await planMailId('t-mine');
    const asked: unknown[] = [];
    // Stands in for the todos module's listener (modules never import each other).
    bus.on('todo.doneRequested', async (req) => {
      asked.push(req);
      await taskRepo().update(req.id, { done: true, completedAt: Date.UTC(2026, 8, 30) });
    });
    await closeAnswered(id);
    expect(asked).toEqual([{ id }]);
    expect((await taskRepo().get(id))?.done).toBe(true);
    expect(lastToast()?.message).toBe(t.mail.answered.closed);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect((await taskRepo().get(id))?.done).toBe(false));
  });

  it('stays quiet when nothing was closed (already done or gone), says so when the listener fails', async () => {
    await closeAnswered('mail-x');
    expect(lastToast()).toBeUndefined();
    bus.on('todo.doneRequested', () => Promise.reject(new Error('x')));
    vi.spyOn(bus, 'emit').mockRejectedValueOnce(new Error('x'));
    await closeAnswered('mail-x');
    expect(lastToast()?.message).toBe(t.mail.answered.failed);
  });
});
