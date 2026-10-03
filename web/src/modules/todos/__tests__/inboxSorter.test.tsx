// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { InboxSorter } from '../components/InboxSorter';
import { INBOX_ID, listRepo, taskRepo } from '../repo';

const base = { done: false, priority: 0, order: 0 };

/** The page feeds the sorter with live data; so does this wrapper. */
function Harness() {
  const tasks = useLiveQuery(() => taskRepo.active().toArray(), []);
  const lists = useLiveQuery(() => listRepo.active().toArray(), []);
  const inbox = (tasks ?? [])
    .filter((x) => x.listId === INBOX_ID && !x.done && !x.someday && !x.parentId && !x.plannedFor)
    .sort((a, b) => a.createdAt - b.createdAt);
  return (
    <InboxSorter
      open
      tasks={inbox as never}
      lists={(lists ?? []) as never}
      onClose={() => undefined}
    />
  );
}

beforeEach(async () => {
  // The clock moves a millisecond per call, so "oldest first" is well defined.
  let tick = new Date(2026, 9, 2, 10, 0).getTime();
  setNow(() => tick++);
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
  await listRepo.create({ name: 'Eingang', order: 0 }, { id: INBOX_ID });
  await listRepo.create({ name: 'Haushalt', order: 1 }, { id: 'haushalt' });
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('InboxSorter', () => {
  it('goes through the inbox one thing at a time', async () => {
    const a = await taskRepo.create({ ...base, listId: INBOX_ID, title: 'Erste Sache' });
    const b = await taskRepo.create({ ...base, listId: INBOX_ID, title: 'Zweite Sache' });
    const c = await taskRepo.create({ ...base, listId: INBOX_ID, title: 'Dritte Sache' });
    render(<Harness />);
    expect(await screen.findByText('Erste Sache')).toBeInTheDocument();
    expect(screen.getByText('1 von 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Für heute' }));
    expect(await screen.findByText('Zweite Sache')).toBeInTheDocument();
    expect((await taskRepo.get(a.id))?.plannedFor).toMatch(/^2026-10-02$/);

    fireEvent.click(screen.getByRole('button', { name: 'Irgendwann' }));
    expect(await screen.findByText('Dritte Sache')).toBeInTheDocument();
    expect((await taskRepo.get(b.id))?.someday).toBe(true);

    fireEvent.change(screen.getByLabelText('In eine Liste'), { target: { value: 'haushalt' } });
    expect(await screen.findByText('Der Eingang ist leer. Gut gemacht.')).toBeInTheDocument();
    expect((await taskRepo.get(c.id))?.listId).toBe('haushalt');
  });

  it('skipping keeps the item and offers to look again', async () => {
    await taskRepo.create({ ...base, listId: INBOX_ID, title: 'Später ansehen' });
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Überspringen' }));
    expect(await screen.findByText('1 Ding hast du übersprungen.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal ansehen' }));
    expect(await screen.findByText('Später ansehen')).toBeInTheDocument();
  });

  it('"Schon erledigt" ticks it off', async () => {
    const t = await taskRepo.create({ ...base, listId: INBOX_ID, title: 'Schon gemacht' });
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: 'Schon erledigt' }));
    await waitFor(async () => expect((await taskRepo.get(t.id))?.done).toBe(true));
    expect(await screen.findByText('Der Eingang ist leer. Gut gemacht.')).toBeInTheDocument();
  });

  it('says it is empty right away when there is nothing to sort', async () => {
    render(<Harness />);
    expect(await screen.findByTestId('inbox-sorter-done')).toHaveTextContent(
      'Der Eingang ist leer.',
    );
  });
});
