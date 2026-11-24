// @vitest-environment jsdom
/**
 * A ToDo's plan panel (planner hub 2, package 4a, hand-off 04): the note's first lines and the checklist as tick
 * lines; no „Erledigt“ of its own; a tick is ToDos' own write with its own undo; X3 for a ToDo that is gone.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { resetUndoJournal, undoLast } from '@/core/undo';
import { tickChecklist } from '../components/PlanPanel';
import { taskRepo } from '../repo';

beforeEach(async () => {
  for (const t of ['todos_task', '_modules']) await db.table(t).clear();
  await db.table('_modules').put({
    id: 'todos',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
  resetUndoJournal();
});

const panel = (id: string) =>
  render(
    <MemoryRouter>
      <PlanPanelHost moduleId="todos" id={id} to={`/todos?open=${id}`} />
    </MemoryRouter>,
  );

it('note and checklist; a tick is ToDos’ own write with its own undo; no „Erledigt“', async () => {
  await taskRepo.create(
    {
      listId: 'inbox',
      title: 'Haushalt',
      done: false,
      priority: 0,
      order: 0,
      note: 'Vor dem Besuch.',
      checklist: [
        { id: 'c1', text: 'Bad wischen', done: false },
        { id: 'c2', text: 'Wäsche', done: true },
      ],
    },
    { id: 'hh' },
  );
  panel('hh');
  expect(await screen.findByText('Vor dem Besuch.')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: '„Wäsche“ abhaken' })).toBeChecked();
  expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  fireEvent.click(screen.getByRole('checkbox', { name: '„Bad wischen“ abhaken' }));
  await waitFor(async () =>
    expect((await taskRepo.get('hh'))?.checklist?.map((c) => c.done)).toEqual([true, true]),
  );
  // Every line ticked: the ToDo stays open – „Erledigt“ is the row's tick.
  expect((await taskRepo.get('hh'))?.done).toBe(false);
  expect(await undoLast()).toBe('„Bad wischen“ abgehakt.');
  expect((await taskRepo.get('hh'))?.checklist?.map((c) => c.done)).toEqual([false, true]);
});

it('undo flips only the ticked line back: a line changed meanwhile (a sync) keeps its change', async () => {
  await taskRepo.create(
    {
      listId: 'inbox',
      title: 'Haushalt',
      done: false,
      priority: 0,
      order: 0,
      checklist: [
        { id: 'a', text: 'Bad', done: false },
        { id: 'b', text: 'Wäsche', done: false },
      ],
    },
    { id: 'hh' },
  );
  await tickChecklist('hh', 'a', true);
  // Another device ticks „Wäsche“ meanwhile (outside the undo).
  const now = await taskRepo.get('hh');
  await taskRepo.update('hh', {
    checklist: now!.checklist!.map((c) => (c.id === 'b' ? { ...c, done: true } : c)),
  });
  await undoLast();
  expect((await taskRepo.get('hh'))?.checklist?.map((c) => [c.id, c.done])).toEqual([
    ['a', false],
    ['b', true],
  ]);
});

it('a plain ToDo (no note, no checklist) shows what the row knows: its detail', async () => {
  await taskRepo.create(
    { listId: 'inbox', title: 'Steuer', done: false, priority: 0, order: 0 },
    { id: 'st' },
  );
  render(
    <MemoryRouter>
      <PlanPanelHost moduleId="todos" id="st" to="/todos?open=st" detail="Frist Fr" />
    </MemoryRouter>,
  );
  expect(await screen.findByText('Frist Fr')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
});

it('a ToDo that is gone (or a foreign id): X3', async () => {
  panel('nope');
  expect(await screen.findByText('Gibt es nicht mehr.')).toBeInTheDocument();
});
