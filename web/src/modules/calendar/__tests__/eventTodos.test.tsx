// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { addLink } from '@/core/entitylinks';
import { getManifest } from '@/core/modules/registry';
import { EventTodos } from '../components/EventTodos';
import { eventRepo } from '../repo';

/** P52: the event lists the ToDos that link to it (the reverse direction of the link table). */
const tasks = () => createCollectionRepo(getManifest('todos')!, 'task');
const task = (title: string, done = false) =>
  tasks().create({ listId: 'inbox', title, done, priority: 0, order: 0 });

beforeEach(async () => {
  for (const t of ['calendar_event', 'todos_task', '_links', '_modules', '_meta'])
    await db.table(t).clear();
});
afterEach(cleanup);

const show = (eventId: string) =>
  render(
    <MemoryRouter>
      <EventTodos eventId={eventId} />
    </MemoryRouter>,
  );

describe('an event lists its preparation ToDos', () => {
  it('„Vorbereitung: <title>“ with its done state, opening the ToDo', async () => {
    const ev = await eventRepo.create({ title: 'Zahnarzt', startDate: '2026-11-20' } as never);
    const open = await task('Unterlagen mitnehmen');
    const done = await task('Termin bestätigen', true);
    for (const t of [open, done])
      await addLink({
        from: { module: 'todos', id: t.id },
        to: { module: 'calendar', id: ev.id },
        rel: 'origin',
        label: 'Zahnarzt',
      });
    show(ev.id);
    const list = await screen.findByTestId('event-todos', {}, { timeout: 5000 });
    const items = [...list.querySelectorAll('li')].map((li) => li.textContent?.trim());
    expect(items).toEqual([
      'Vorbereitung: Unterlagen mitnehmen',
      'Vorbereitung: Termin bestätigen · erledigt',
    ]);
    expect(
      screen.getByRole('link', { name: 'Vorbereitung öffnen: Unterlagen mitnehmen' }),
    ).toHaveProperty('href', expect.stringContaining(`/todos?open=${open.id}`));
  });

  it('shows nothing for an event without one, nor for a ToDo that is gone', async () => {
    const ev = await eventRepo.create({ title: 'Kino', startDate: '2026-11-21' } as never);
    const gone = await task('Weg');
    await addLink({
      from: { module: 'todos', id: gone.id },
      to: { module: 'calendar', id: ev.id },
      rel: 'origin',
      label: 'Kino',
    });
    await tasks().remove(gone.id);
    show(ev.id);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByTestId('event-todos')).toBeNull();
  });
});
