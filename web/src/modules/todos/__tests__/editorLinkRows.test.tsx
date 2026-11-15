// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLiveQuery } from 'dexie-react-hooks';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { addLink, linkEntries } from '@/core/entitylinks';
import { copyTodoLinks } from '@/core/entitylinks/migrate';
import { LINKS_TABLE } from '@/core/entitylinks/store';
import { getManifest } from '@/core/modules/registry';
import { undoLast } from '@/core/undo';
import { TaskEditor } from '../components/TaskEditor';
import { taskRepo } from '../repo';

/** The ToDo editor shows the task's own `links[]` and its rows of the link table as one list (planner hub K2). */
const events = createCollectionRepo(getManifest('calendar')!, 'event');
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
type StoredTask = Awaited<ReturnType<typeof taskRepo.create>>;

function LiveEditor({ first }: { first: StoredTask }) {
  const task = useLiveQuery(() => taskRepo.get(first.id), [first.id]) ?? first;
  return <TaskEditor task={task} subtasks={[]} lists={[]} onClose={() => {}} />;
}
const show = (task: StoredTask) =>
  render(
    <MemoryRouter>
      <LiveEditor first={task} />
    </MemoryRouter>,
  );
const event = (title: string) => events.create({ title, allDay: true, startDate: '2026-11-17' });
const ref = (task: StoredTask) => ({ module: 'todos', id: task.id });
const liveRows = async (task: StoredTask) =>
  (await linkEntries(ref(task))).map((e) => e.other.id).sort();

beforeEach(async () => {
  for (const t of ['todos_task', 'calendar_event', LINKS_TABLE, '_modules', '_meta'])
    await db.table(t).clear();
});
afterEach(cleanup);

it('shows rows ∪ array: a link in both places once, a link only in the table too', async () => {
  const both = await event('In beiden');
  const onlyRow = await event('Nur Zeile');
  const task = await taskRepo.create({
    ...base,
    title: 'Vorbereiten',
    links: [{ kind: 'event', id: both.id, label: 'In beiden' }],
  });
  await copyTodoLinks();
  await addLink({
    from: ref(task),
    to: { module: 'calendar', id: onlyRow.id },
    rel: 'about',
    label: 'Nur Zeile',
  });
  show(task);
  expect(await screen.findByRole('button', { name: 'Termin: Nur Zeile' })).toBeEnabled();
  expect(screen.getAllByRole('button', { name: 'Termin: In beiden' })).toHaveLength(1);
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

it('„Entfernen“ drops both the array entry and the row; one undo brings both back', async () => {
  const e = await event('Zahnarzt');
  const task = await taskRepo.create({
    ...base,
    title: 'Aufräumen',
    links: [{ kind: 'event', id: e.id, label: 'Zahnarzt' }],
  });
  await copyTodoLinks();
  expect(await liveRows(task)).toEqual([e.id]);
  show(task);
  await screen.findByRole('button', { name: 'Termin: Zahnarzt' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Termin: Zahnarzt' })).toBeEnabled(),
  );
  await userEvent.click(
    screen.getByRole('button', { name: /Zahnarzt.*entfernen|entfernen.*Zahnarzt/i }),
  );
  await waitFor(async () => expect((await taskRepo.get(task.id))?.links).toBeUndefined());
  await waitFor(async () => expect(await liveRows(task)).toEqual([]));
  // The copy never brings it back: the row is a tombstone, the array entry is gone.
  expect(await copyTodoLinks()).toBe(0);
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Termin: Zahnarzt' })).toBeNull(),
  );

  await undoLast();
  await waitFor(async () => expect(await liveRows(task)).toEqual([e.id]));
  expect((await taskRepo.get(task.id))?.links).toHaveLength(1);
});

it('removing a link that lives only in the table removes that row', async () => {
  const e = await event('Nur Zeile');
  const task = await taskRepo.create({ ...base, title: 'Ohne Feld' });
  await addLink({
    from: ref(task),
    to: { module: 'calendar', id: e.id },
    rel: 'about',
    label: 'Nur Zeile',
  });
  show(task);
  await screen.findByRole('button', { name: 'Termin: Nur Zeile' });
  await userEvent.click(
    screen.getByRole('button', { name: /Nur Zeile.*entfernen|entfernen.*Nur Zeile/i }),
  );
  await waitFor(async () => expect(await liveRows(task)).toEqual([]));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Termin: Nur Zeile' })).toBeNull(),
  );
});

it('a row into the vault or to something that is no link target never shows (read guard of `useLinks`)', async () => {
  const task = await taskRepo.create({ ...base, title: 'Bank' });
  const raw = (id: string, module: string) =>
    db.table(LINKS_TABLE).put({
      id,
      from: ref(task),
      to: { module, id: 'x1' },
      rel: 'about',
      label: 'Bank-Login',
      fromKey: `todos:${task.id}`,
      toKey: `${module}:x1`,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'other',
      deletedAt: null,
      _f: {},
    });
  await raw('raw-vault', 'accounts');
  await raw('raw-habits', 'habits');
  const e = await event('Echt');
  await addLink({
    from: ref(task),
    to: { module: 'calendar', id: e.id },
    rel: 'about',
    label: 'Echt',
  });
  show(task);
  await screen.findByRole('button', { name: 'Termin: Echt' });
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.queryByText(/Bank-Login/)).toBeNull();
});
