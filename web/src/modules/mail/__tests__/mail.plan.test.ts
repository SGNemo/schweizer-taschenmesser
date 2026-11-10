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
import {
  deletedThreads,
  fromOf,
  planMail,
  planMailId,
  planMany,
  plannedThreads,
  safeThreadId,
} from '../planMail';
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

  it('the title is „Name · Betreff“, never an address, never empty', () => {
    const none = 'Ohne Betreff';
    expect(mailPlanTitle(anna.from, anna.subject, none)).toBe('Anna Beispiel · Wochenende?');
    expect(mailPlanTitle(noName.from, noName.subject, none)).toBe('Unterlagen');
    expect(mailPlanTitle({ name: 'x@example.org', email: 'x@example.org' }, 'Hallo', none)).toBe(
      'Hallo',
    );
    expect(mailPlanTitle({ email: 'x@example.org' }, 'Re: ', none)).toBe(none);
  });

  it('a reply of one’s own never names the ToDo after oneself', async () => {
    const own = {
      id: 't-own',
      from: { name: 'Ich', email: 'me@example.org' },
      subject: 'Re: Termin',
    };
    await planMail(account, own, () => undefined);
    const [task] = await live('todos_task');
    expect(task.title).toBe('Termin');
  });
});

describe('words and the other party', () => {
  it('the thread view takes the newest message not from this account, else the first', () => {
    const me = { name: 'Ich', email: 'ME@example.org' };
    const msgs = [{ from: anna.from }, { from: me }];
    expect(fromOf(account, msgs)).toEqual(anna.from);
    expect(fromOf(account, [{ from: me }])).toEqual(me);
  });

  it('planner off: the undo/again words say „ToDo“, never „Plan“', async () => {
    await planMail(account, anna, () => undefined);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(0));
    expect(await deletedThreads(['t-anna', 't-x'])).toEqual(new Set(['t-anna']));
    await planMail(account, anna, () => undefined);
    expect(lastToast()?.message).toBe(t.mail.plan.todo.was);
    expect(lastToast()?.action?.label).toBe(t.mail.plan.todo.reinstate);
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
    expect(lastToast()?.message).toBe(t.mail.plan.alreadyTodo);
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
    expect(lastToast()?.message).toBe(t.mail.plan.todo.was);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(1));
    expect((await live('todos_task'))[0]!.id).toBe(await planMailId('t-anna'));
  });

  it('a ToDo from before the planner was on says „Schon als ToDo da“, not „im Plan“', async () => {
    await planMail(account, anna, () => undefined);
    await enableModule(getManifest('planner')!);
    await planMail(account, anna, () => undefined);
    expect(lastToast()?.message).toBe(t.mail.plan.alreadyTodo);
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
  it('a ticked mail whose ToDo was deleted comes back; nothing new → „Schon im Plan“ without undo', async () => {
    await planMail(account, anna, () => undefined);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(0));
    // Not ticked as „war im Plan“ (e.g. deleted on another device after the preview): stays deleted.
    await planMany(account, [anna], () => undefined);
    expect(await live('todos_task')).toHaveLength(0);
    await planMany(account, [anna], () => undefined, new Set(['t-anna']));
    expect((await live('todos_task')).map((x) => x.title)).toEqual(['Anna Beispiel · Wochenende?']);
    expect(lastToast()?.message).toBe(t.mail.plan.todo.allDone(1));
    await planMany(account, [anna], () => undefined);
    expect(lastToast()?.message).toBe(t.mail.plan.alreadyTodo);
    expect(lastToast()?.action).toBeUndefined();
  });

  it('writes only what was ticked, skips an existing one untouched, one undo for what it wrote', async () => {
    await planMail(account, anna, () => undefined);
    const before = (await live('todos_task'))[0]!;
    await planMany(account, [anna, noName], () => undefined);
    const tasks = await live('todos_task');
    expect(tasks.map((x) => x.title).sort()).toEqual(['Anna Beispiel · Wochenende?', 'Unterlagen']);
    expect(tasks.find((x) => x.id === before.id)!.updatedAt).toBe(before.updatedAt);
    expect(lastToast()?.message).toBe(t.mail.plan.todo.allDone(1));
    lastToast()!.action!.run();
    await vi.waitFor(async () =>
      expect((await live('todos_task')).map((x) => x.title)).toEqual([
        'Anna Beispiel · Wochenende?',
      ]),
    );
    expect(await linkRepo.active().count()).toBe(1);
  });
});

describe('planMany all or nothing', () => {
  it('a failure after the save takes back the new ToDo, the revived one and their link rows', async () => {
    await planMail(account, anna, () => undefined);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(0));
    const links = (await live('mail_link')).length;
    const create = linkRepo.create.bind(linkRepo);
    const spy = vi.spyOn(linkRepo, 'create');
    spy.mockImplementationOnce(create).mockRejectedValueOnce(new Error('disk'));
    await planMany(account, [anna, noName], () => undefined, new Set(['t-anna']));
    spy.mockRestore();
    expect(await live('todos_task')).toHaveLength(0);
    expect((await live('mail_link')).length).toBe(links);
    expect(lastToast()?.message).toBe(t.mail.plan.failed);
  });

  it('undo leaves the link row of an entry that was there before (another device’s)', async () => {
    await planMail(other, anna, () => undefined);
    await planMany(account, [anna, noName], () => undefined);
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live('todos_task')).toHaveLength(1));
    expect(await plannedThreads(account.key)).toEqual(new Set(['t-anna']));
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
