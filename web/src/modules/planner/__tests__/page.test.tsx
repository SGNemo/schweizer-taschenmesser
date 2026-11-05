// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { assignmentRepo, dayRepo, itemRepo } from '../repo';
import PlannerPage from '../routes/PlannerPage';

const NOW = new Date(2026, 10, 9, 10, 0).getTime(); // Monday 2026-11-09
const todos = getManifest('todos')!;
const taskRepo = createCollectionRepo(todos, 'task');

const draw = () =>
  render(
    <MemoryRouter initialEntries={['/planner']}>
      <PlannerPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
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
});
afterEach(() => setNow());

describe('planner page', () => {
  it('shows the head figure, seven columns, rows with minutes and parts, a blocker, the waiting group', async () => {
    const a = await taskRepo.create({
      listId: 'inbox',
      title: 'Steuer',
      done: false,
      priority: 2,
      order: 0,
      estimateMin: 120,
    });
    const b = await taskRepo.create({
      listId: 'inbox',
      title: 'Keller',
      done: false,
      priority: 0,
      order: 0,
    });
    await dayRepo.upsert('2026-11-10', {
      date: '2026-11-10',
      blockers: [{ id: 'z', label: 'Zahnarzt', min: 60 }],
    });
    await assignmentRepo.upsert(`todos:${a.id}#0`, {
      itemKey: `todos:${a.id}`,
      k: 0,
      of: 2,
      date: '2026-11-09',
      minutes: 60,
      order: 0,
      reason: 'new',
    });
    await assignmentRepo.upsert(`todos:${a.id}#1`, {
      itemKey: `todos:${a.id}`,
      k: 1,
      of: 2,
      date: '2026-11-10',
      minutes: 60,
      order: 0,
      reason: 'new',
    });
    await itemRepo.upsert(`todos:${b.id}`, {
      source: { module: 'todos', id: b.id },
      excluded: true,
      order: 0,
    });
    draw();
    // (The head figure renders into the frame's hero slot, which only exists inside the shell: e2e covers it.)
    const board = await screen.findByRole('group', { name: 'Wochenbrett' });
    expect(board.querySelectorAll('section')).toHaveLength(7);
    expect(screen.getByTestId('day-2026-11-09')).toHaveTextContent('2 h 12 frei von 3 h 12');
    expect(screen.getByText('Teil 1 von 2')).toHaveClass('sr-only');
    expect(screen.getByText('Zahnarzt')).toBeInTheDocument();
    expect(screen.getByTestId('day-2026-11-10')).toHaveTextContent('1 h 24 frei von 2 h 24');
    // „Nicht planen“ things sit in the waiting group with a way back.
    expect(screen.getByText('Wartet auf freie Zeit')).toBeInTheDocument();
    expect(screen.getByText('Keller')).toBeInTheDocument();
    // Erledigt is one tap: a tick in the row; „Warum hier?“ sits in the ⋯ menu, no reason text at rest.
    expect(screen.getAllByRole('checkbox', { name: 'Erledigt' }).length).toBeGreaterThan(0);
    expect(screen.queryByText('neu, nach Priorität')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Warum hier?' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktionen für Steuer' })[0]!);
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Warum hier?' }));
    await waitFor(() => expect(screen.getByText('neu, nach Priorität')).toBeInTheDocument());
    // Excluded things carry a state, not a verb.
    expect(screen.getByText('nicht im Plan')).toBeInTheDocument();
  });

  it('a day off says so in the head and the empty board offers the one field', async () => {
    await dayRepo.upsert('2026-11-09', { date: '2026-11-09', availableMin: 0, blockers: [] });
    draw();
    expect(await screen.findByTestId('day-2026-11-09')).toHaveTextContent('frei');
    expect(screen.getByTestId('day-2026-11-09')).not.toHaveTextContent('frei von');
    expect(screen.getByLabelText('Eintragen')).toBeInTheDocument();
    // One empty state for the whole board, not seven „Nichts geplant“.
    expect(screen.getByTestId('planner-empty')).toHaveTextContent(
      'Noch nichts geplant. Eine Sache reicht.',
    );
    expect(screen.queryAllByText('Nichts geplant')).toHaveLength(0);
    expect(screen.queryByText('Wartet auf freie Zeit')).toBeNull();
  });
});
