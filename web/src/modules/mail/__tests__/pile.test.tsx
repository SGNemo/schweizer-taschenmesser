// @vitest-environment jsdom
/**
 * The mail part of „E-Mails durchgehen“ (planner hub 2, package 2; hand-off 02 „Tests“): the count is the queue's
 * threads without a plan ToDo (open or done) – a mail in the plan counts once, as its member, a thread whose ToDo is
 * done leaves the count; the open ToDos are the members, by key. P15 opens `PlanAllDialog` and writes nothing before
 * its own button; bulk mail and mails whose ToDo was deleted stay unticked. Ids and counts only – no content.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { PlanQueue } from '../components/PlanQueue';
import source, { QUEUE_PANEL } from '../pile';
import { planMailId } from '../planMail';
import { QUEUE_ROUTE } from '../queue';

const stamp = { createdAt: 1, updatedAt: 1, deviceId: 't', deletedAt: null, _f: {} };
const NOW = new Date(2026, 10, 30, 10, 0).getTime();

async function thread(id: string, subject: string, personal = true) {
  await db.table('mail_thread').put({
    ...stamp,
    id: `demo|${id}`,
    accountKey: 'demo',
    threadId: id,
    sortKey: NOW - 3_600_000,
    unread: true,
    inbox: true,
    demo: {
      from: { name: 'Anna Beispiel', email: 'anna@example.org' },
      subject,
      snippet: '…',
      messageCount: 1,
      hasAttachment: false,
      labelIds: ['INBOX'],
      personal,
    },
  });
}
async function todo(threadId: string, state: { done?: boolean; deleted?: boolean }) {
  const id = await planMailId(threadId);
  await db.table('todos_task').put({
    ...stamp,
    id,
    listId: 'inbox',
    title: 'x',
    done: !!state.done,
    priority: 0,
    order: 0,
    deletedAt: state.deleted ? 2 : null,
  });
  await db.table('mail_link').put({
    ...stamp,
    id: `l-${threadId}`,
    accountKey: 'demo',
    threadId,
    messageId: 'm',
    type: 'todo',
    moduleId: 'todos',
    collection: 'task',
    entryId: id,
  });
  return id;
}

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of ['mail_thread', 'mail_link', 'todos_task', '_settings'])
    await db.table(t).clear();
  await thread('t1', 'Treffen am Samstag?');
  await thread('t2', 'Angebot Fensterputz');
  await thread('t3', 'Nebenkosten');
  await thread('t4', 'Schlüssel abholen');
});

describe('the mail part', () => {
  it('counts the queue without a plan ToDo; the open ToDos are members; a done one leaves the count', async () => {
    const open = await todo('t2', {});
    await todo('t3', { done: true });
    await todo('t4', { deleted: true });
    const [part] = await source({ today: '2026-11-30', until: '2026-12-13' });
    // t1 and t4 (its ToDo was deleted) wait; t2 is its member; t3 is done.
    expect(part).toMatchObject({ area: 'mail', count: 2, panel: QUEUE_PANEL, to: QUEUE_ROUTE });
    expect(part?.members).toEqual([`todos:${open}`]);
    expect(JSON.stringify(part)).not.toMatch(/Treffen|Anna|Nebenkosten|example/);
  });

  it('P15 opens PlanAllDialog over the planner and writes nothing before its own button; deleted and bulk stay unticked', async () => {
    await todo('t4', { deleted: true });
    await thread('t5', 'Newsletter', false);
    const written = async () =>
      JSON.stringify(
        await Promise.all(
          ['todos_task', 'mail_link', 'planner_item', 'planner_assignment'].map((t) =>
            db.table(t).toArray(),
          ),
        ),
      );
    const before = await written();
    render(
      <MemoryRouter>
        <PlanQueue />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^In den Plan … \(/ }));
    const dialog = await screen.findByRole('dialog');
    const box = (title: string) =>
      within(dialog).getByRole('checkbox', { name: new RegExp(title) }) as HTMLInputElement;
    expect(box('Treffen').checked).toBe(true);
    expect(box('Schlüssel').checked).toBe(false);
    // Bulk mail is no member of the queue: not even in the dialog.
    expect(within(dialog).queryByRole('checkbox', { name: /Newsletter/ })).toBeNull();
    expect(await written()).toBe(before);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(await written()).toBe(before);
  });
});
