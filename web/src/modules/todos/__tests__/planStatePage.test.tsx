// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus, type EventMap } from '@/core/events';
import { setNow } from '@/core/time/now';
import TodosPage from '../routes/TodosPage';
import { listRepo, taskRepo } from '../repo';

const NOW = new Date(2026, 10, 18, 10, 0).getTime(); // Wednesday 2026-11-18
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const mark = (date: string) => ({ plannedFor: date, planMark: { date, order: 0 } });

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}
const draw = (url = '/todos') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/planner" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
const planner = (enabled: boolean) =>
  db.table('_modules').put({
    id: 'planner',
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
const rowOf = (title: string) =>
  screen
    .getAllByText(title)
    .find((el) => el.closest('li'))!
    .closest('li')!;

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'todos_task',
    'todos_list',
    '_settings',
    '_meta',
    '_modules',
    'planner_item',
    'planner_assignment',
  ])
    await db.table(t).clear();
  localStorage.clear();
  bus.clear();
  await listRepo.create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
});
afterEach(() => {
  cleanup();
  setNow();
  bus.clear();
});

async function seed() {
  await taskRepo.create({ ...base, title: 'Heute im Plan', ...mark('2026-11-18') }, { id: 'a' });
  await taskRepo.create({ ...base, title: 'Freitag im Plan', ...mark('2026-11-20') }, { id: 'b' });
  await taskRepo.create({ ...base, title: 'Weit weg', ...mark('2026-12-02') }, { id: 'c' });
  await taskRepo.create({ ...base, title: 'War Montag', ...mark('2026-11-16') }, { id: 'd' });
  await taskRepo.create({ ...base, title: 'Lose eins' }, { id: 'e' });
  await taskRepo.create({ ...base, title: 'Lose zwei', plannedFor: '2026-11-19' }, { id: 'f' });
  await taskRepo.create({ ...base, title: 'Irgendwann', someday: true }, { id: 'g' });
  await taskRepo.create({ ...base, title: 'Unteraufgabe', parentId: 'e' }, { id: 'h' });
}

describe('the plan state in ToDos', () => {
  it('marks every open task in the list with the planner’s words; none for someday and subtasks', async () => {
    await planner(true);
    await seed();
    draw('/todos');
    await waitFor(() => expect(screen.getAllByTestId('plan-mark').length).toBe(2));
    expect(within(rowOf('Heute im Plan')).getByTestId('in-plan')).toHaveTextContent(
      'im Plan: heute',
    );
    expect(within(rowOf('Freitag im Plan')).getByTestId('in-plan')).toHaveTextContent(
      'im Plan: Fr',
    );
    expect(within(rowOf('Weit weg')).getByTestId('in-plan')).toHaveTextContent(
      /^im Plan: Mi 2\.12\.?$/,
    );
    expect(within(rowOf('War Montag')).getByTestId('in-plan')).toHaveTextContent('im Plan: war Mo');
    // A date set in ToDos is no day in the plan.
    expect(within(rowOf('Lose zwei')).getByTestId('plan-mark')).toHaveTextContent(
      'noch nicht im Plan',
    );
    expect(within(rowOf('Unteraufgabe')).queryByTestId('plan-mark')).toBeNull();
    // No colour: the marks carry no tone of their own.
    expect(within(rowOf('War Montag')).getByTestId('in-plan').className).not.toMatch(/overdue/);
  });

  it('the filter shows its number, keeps its choice on this device and works with the views', async () => {
    await planner(true);
    await seed();
    const first = draw('/todos');
    const unplanned = await screen.findByTestId('plan-filter-unplanned');
    await waitFor(() => expect(unplanned).toHaveTextContent('Noch nicht im Plan · 2'));
    await userEvent.click(unplanned);
    expect(unplanned).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.queryByText('Freitag im Plan')).toBeNull());
    expect(rowOf('Lose eins')).toBeTruthy();
    // The subtask rides along with its main task.
    expect(screen.getAllByText('Unteraufgabe').length).toBeGreaterThan(0);
    first.unmount();
    // Remembered per device.
    draw('/todos?view=soon');
    await waitFor(() =>
      expect(screen.getByTestId('plan-filter-unplanned')).toHaveAttribute('aria-pressed', 'true'),
    );
    // Bald with the filter: only „Lose zwei“ (Thursday, its own date).
    await waitFor(() =>
      expect(screen.getByTestId('plan-filter-unplanned')).toHaveTextContent('· 1'),
    );
    await waitFor(() => expect(rowOf('Lose zwei')).toBeTruthy());
    expect(screen.queryByText('Freitag im Plan')).toBeNull();
    await userEvent.click(screen.getByTestId('plan-filter-planned'));
    await waitFor(() => expect(rowOf('Freitag im Plan')).toBeTruthy());
    expect(screen.queryAllByText('Lose zwei').filter((el) => el.closest('li'))).toEqual([]);
  });

  it('planner off: no mark, no filter, no selection – also with a stored filter', async () => {
    localStorage.setItem('todos.planFilter', 'unplanned');
    await planner(false);
    await seed();
    draw('/todos');
    await waitFor(() => expect(rowOf('Freitag im Plan')).toBeTruthy());
    expect(rowOf('Lose eins')).toBeTruthy();
    expect(screen.queryByTestId('plan-mark')).toBeNull();
    expect(screen.queryByTestId('in-plan')).toBeNull();
    expect(screen.queryByTestId('plan-filter-all')).toBeNull();
    expect(screen.queryByTestId('todos-select')).toBeNull();
  });

  it('a tap on „im Plan: Fr“ opens the planner on that day with the row; a passed one opens „Noch offen“', async () => {
    await planner(true);
    await seed();
    const view = draw('/todos');
    await userEvent.click(
      await within(await waitFor(() => rowOf('Freitag im Plan'))).findByTestId('in-plan'),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/planner?day=2026-11-20&item=todos%3Ab',
    );
    view.unmount();
    draw('/todos');
    await userEvent.click(
      await within(await waitFor(() => rowOf('War Montag'))).findByTestId('in-plan'),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/planner?tab=open&item=todos%3Ad',
    );
  });

  it('several at once: „Auswählen“ → „In den Plan …“ → Morgen asks the planner for exactly those', async () => {
    await planner(true);
    await seed();
    const seen: EventMap['plan.requested'][] = [];
    bus.on('plan.requested', (req) => void seen.push(req));
    draw('/todos');
    await userEvent.click(await screen.findByTestId('todos-select'));
    await userEvent.click(
      within(rowOf('Lose eins')).getByRole('checkbox', { name: '„Lose eins“ auswählen' }),
    );
    await userEvent.click(
      within(rowOf('Lose zwei')).getByRole('checkbox', { name: '„Lose zwei“ auswählen' }),
    );
    await userEvent.click(screen.getByTestId('todos-to-plan'));
    const dialog = await screen.findByRole('dialog', { name: 'In den Plan: 2 Aufgaben' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Morgen' }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.refs).toEqual([
      { module: 'todos', id: 'e' },
      { module: 'todos', id: 'f' },
    ]);
    expect(seen[0]!.day).toBe('2026-11-19');
    // The mode ends after the action.
    await waitFor(() => expect(screen.queryByTestId('todos-to-plan')).toBeNull());
  });

  it('„noch nicht im Plan“ opens the day choice for that task; „Noch ohne Tag“ asks without a day', async () => {
    await planner(true);
    await seed();
    const seen: EventMap['plan.requested'][] = [];
    bus.on('plan.requested', (req) => void seen.push(req));
    draw('/todos');
    await userEvent.click(
      await within(await waitFor(() => rowOf('Lose eins'))).findByTestId('plan-mark'),
    );
    const dialog = await screen.findByRole('dialog', { name: 'In den Plan: Lose eins' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Noch ohne Tag' }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toMatchObject({ refs: [{ module: 'todos', id: 'e' }], day: null });
  });
});
