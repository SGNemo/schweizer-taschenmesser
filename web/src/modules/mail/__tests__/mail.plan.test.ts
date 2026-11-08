// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { isPersonalMail } from '@/core/mail/heuristics';
import { mailPlanTitle } from '@/core/mail/prefill';
import type { MailAccountRef } from '@/core/mail/types';
import { disableModule, enableModule } from '@/core/modules/activation';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { captureId } from '@/quickCapture/targets';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { planMail, planMailId, planMany, plannedThreads, safeThreadId } from '../planMail';
import { linkRepo } from '../repo';

// „Kopf leer“ 3a: one tap from a mail into the plan. Invented data.
const account: MailAccountRef = {
  key: 'google#a1',
  connectorId: 'google',
  email: 'me@example.org',
};
const other: MailAccountRef = { key: 'google#b2', connectorId: 'google', email: 'me@example.org' };
const anna = {
  id: 't-anna',
  from: { name: 'Anna Beispiel', email: 'anna@example.org' },
  subject: 'Re: Wochenende?',
};
const noName = { id: 't-x', from: { email: 'someone@example.org' }, subject: 'Unterlagen' };

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
  useUiStore.setState({ toasts: [] });
  await disableModule(getManifest('planner')!, 'keep');
});
afterEach(() => setNow());

const lastToast = () => useUiStore.getState().toasts.at(-1);
const live = async (table: string) =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null);

describe('ids and titles', () => {
  it('the id comes from the thread id alone: two account keys, one id; inputs exactly [threadId, "todo"]', async () => {
    const id = await planMailId('t-anna');
    expect(id).toBe(`mail-${await captureId(['t-anna', 'todo'])}`);
    expect(id).not.toContain('google');
    expect(id).not.toContain('@');
  });

  it('the title is „Name · Betreff“ and never an address', () => {
    expect(mailPlanTitle(anna.from, anna.subject)).toBe('Anna Beispiel · Wochenende?');
    expect(mailPlanTitle(noName.from, noName.subject)).toBe('Unterlagen');
    expect(mailPlanTitle({ name: 'x@example.org', email: 'x@example.org' }, 'Hallo')).toBe('Hallo');
  });
});

describe('planMail', () => {
  it('one tap: a ToDo with title, 15 minutes, the way back; no address or account key anywhere', async () => {
    await planMail(account, anna, () => undefined);
    const [task] = await live('todos_task');
    expect(task).toMatchObject({ title: 'Anna Beispiel · Wochenende?', estimateMin: 15 });
    expect(task.links).toEqual([{ kind: 'mail', id: 't-anna', label: 'Wochenende?' }]);
    const stored = JSON.stringify(task);
    expect(stored).not.toMatch(/@|google#|authuser/);
    expect(lastToast()?.message).toBe(t.mail.plan.savedTodo);
    expect(await plannedThreads(account.key)).toEqual(new Set(['t-anna']));
  });

  it('the same mail again (also from another account key): „Schon im Plan“, one ToDo, no undo', async () => {
    await planMail(account, anna, () => undefined);
    await planMail(other, anna, () => undefined);
    expect(await live('todos_task')).toHaveLength(1);
    expect(lastToast()?.message).toBe(t.mail.plan.already);
    expect(lastToast()?.action).toBeUndefined();
    // Each account key keeps its own link row (device-local); the entry is shared.
    expect((await live('mail_link')).map((r) => r.accountKey).sort()).toEqual([
      'google#a1',
      'google#b2',
    ]);
  });

  it('undo, then again: „War im Plan · Wieder einplanen“ brings the same entry back', async () => {
    await planMail(account, anna, () => undefined);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(0));
    await planMail(account, anna, () => undefined);
    expect(lastToast()?.message).toBe(t.mail.plan.was);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(1));
    expect((await live('todos_task'))[0]!.id).toBe(await planMailId('t-anna'));
  });

  it('with the planner on, a plan entry is written beside the ToDo', async () => {
    await enableModule(getManifest('planner')!);
    await planMail(account, anna, () => undefined);
    expect(await live('todos_task')).toHaveLength(1);
    expect((await live('planner_item')).map((r) => r.id)).toEqual([
      `todos:${await planMailId('t-anna')}`,
    ]);
  });
});

describe('planMany', () => {
  it('writes only what was ticked, skips an existing one untouched, one undo for what it wrote', async () => {
    await planMail(account, anna, () => undefined);
    const before = (await live('todos_task'))[0]!;
    await planMany(account, [anna, noName], () => undefined);
    const tasks = await live('todos_task');
    expect(tasks.map((x) => x.title).sort()).toEqual(['Anna Beispiel · Wochenende?', 'Unterlagen']);
    expect(tasks.find((x) => x.id === before.id)!.updatedAt).toBe(before.updatedAt);
    expect(lastToast()?.message).toBe(t.mail.plan.allDone(1));
    lastToast()!.action!.run();
    await vi.waitFor(async () =>
      expect((await live('todos_task')).map((x) => x.title)).toEqual([
        'Anna Beispiel · Wochenende?',
      ]),
    );
    expect(await linkRepo.active().count()).toBe(1);
  });
});

describe('untrusted input and the personal flag', () => {
  it('`?open=` passes only a plain provider id', () => {
    expect(safeThreadId('18c2f0a9b3d4e5f6')).toBe('18c2f0a9b3d4e5f6');
    for (const bad of [
      '',
      null,
      '../x',
      'a b',
      '<img src=x>',
      'https://evil.example',
      'a"b',
      'x'.repeat(129),
    ])
      expect(safeThreadId(bad)).toBeUndefined();
  });

  it('a person: no unsubscribe link, no bulk precedence, no Gmail bulk category', () => {
    expect(isPersonalMail({ labelIds: ['INBOX'] })).toBe(true);
    expect(isPersonalMail({ labelIds: ['INBOX'], listUnsubscribe: '<mailto:x@example.org>' })).toBe(
      false,
    );
    expect(isPersonalMail({ labelIds: ['INBOX'], precedence: 'bulk' })).toBe(false);
    expect(isPersonalMail({ labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'] })).toBe(false);
  });
});
