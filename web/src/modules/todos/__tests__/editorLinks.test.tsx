// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { getPlatform } from '@/core/platform';
import { undoLast } from '@/core/undo';
import { TaskEditor } from '../components/TaskEditor';
import { taskRepo } from '../repo';

const events = createCollectionRepo(getManifest('calendar')!, 'event');
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname + loc.search}</output>;
}

const show = (task: Awaited<ReturnType<typeof taskRepo.create>>) =>
  render(
    <MemoryRouter>
      <TaskEditor task={task} subtasks={[]} lists={[]} onClose={() => {}} />
      <Where />
    </MemoryRouter>,
  );

beforeEach(async () => {
  for (const t of ['todos_task', 'calendar_event', '_modules', '_meta']) await db.table(t).clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('an alive link shows the target’s title of today and opens its route', async () => {
  const event = await events.create({
    title: 'Zahnarzt neu',
    allDay: true,
    startDate: '2026-11-17',
  });
  const task = await taskRepo.create({
    ...base,
    title: 'Vorbereiten',
    links: [{ kind: 'event', id: event.id, label: 'Zahnarzt' }],
  });
  show(task);
  await userEvent.click(await screen.findByRole('button', { name: 'Termin: Zahnarzt neu' }));
  expect(screen.getByTestId('where').textContent).toBe(`/calendar?open=${event.id}`);
});

it('a gone link says so and „Entfernen“ takes only that entry off the task, with undo', async () => {
  const event = await events.create({ title: 'Bleibt', allDay: true, startDate: '2026-11-17' });
  const task = await taskRepo.create({
    ...base,
    title: 'Aufräumen',
    links: [
      { kind: 'event', id: 'deleted-long-ago', label: '<b>Alter Termin</b>' },
      { kind: 'event', id: event.id, label: 'Bleibt' },
    ],
  });
  show(task);
  // The label is text, never markup.
  const row = (await screen.findByText(/Gibt es nicht mehr\./)).closest('li')!;
  expect(row.textContent).toContain('Termin: <b>Alter Termin</b> · Gibt es nicht mehr.');
  expect(row.querySelector('b')).toBeNull();
  await userEvent.click(within(row).getByRole('button', { name: /entfernen/i }));
  await waitFor(async () =>
    expect((await taskRepo.get(task.id))?.links).toEqual([
      { kind: 'event', id: event.id, label: 'Bleibt' },
    ]),
  );
  expect(screen.queryByText(/Gibt es nicht mehr\./)).toBeNull();
  expect(await undoLast()).toBeTruthy();
  expect((await taskRepo.get(task.id))?.links).toHaveLength(2);
});

it('a link into a module that is not here shows the label; „Im Browser öffnen“ only with an address', async () => {
  const openUrl = vi.spyOn(getPlatform().app, 'openUrl').mockResolvedValue(undefined);
  const task = await taskRepo.create({
    ...base,
    title: 'Antworten',
    links: [
      // Mail is desktop only (not on the test's web platform); notes are off by default.
      { kind: 'mail', id: 'thread-1', label: 'Betreff der Mail' },
      { kind: 'note', id: 'n1', label: 'Notizzettel' },
    ],
  });
  show(task);
  const note = (await screen.findByText('Notiz: Notizzettel')).closest('li')!;
  expect(within(note).queryByRole('button', { name: 'Im Browser öffnen' })).toBeNull();
  const mail = screen.getByText('Mail: Betreff der Mail').closest('li')!;
  // No provider is registered in this test, so there is no address and no button; nothing opens by itself.
  expect(within(mail).queryByRole('button', { name: 'Im Browser öffnen' })).toBeNull();
  expect(openUrl).not.toHaveBeenCalled();
});
