// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { TodayCard } from '../components/TodayCard';
import TodosPage from '../routes/TodosPage';
import { listRepo, taskRepo } from '../repo';

const NOW = new Date(2026, 10, 3, 10, 0).getTime(); // 2026-11-03
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };

const draw = (url = '/todos') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TodosPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
  await db.table('_settings').clear();
  await db.table('_meta').clear();
  await listRepo.create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
});
afterEach(() => {
  cleanup();
  setNow();
});

async function seedThree() {
  await taskRepo.create({ ...base, title: 'Heute fällig', dueDate: '2026-11-03' });
  await taskRepo.create({ ...base, title: 'Nächste Woche', dueDate: '2026-11-10' });
  await taskRepo.create({ ...base, title: 'Ohne Datum' });
}

describe('ToDos views', () => {
  it('shows one task per view by its dates', async () => {
    await seedThree();
    const { unmount } = draw('/todos?view=today');
    expect(await screen.findByText('Heute fällig')).toBeVisible();
    expect(screen.queryByText('Nächste Woche')).toBeNull();
    expect(screen.queryByText('Ohne Datum')).toBeNull();
    unmount();
    draw('/todos?view=soon');
    expect(await screen.findByText('Nächste Woche')).toBeVisible();
    expect(screen.queryByText('Heute fällig')).toBeNull();
  });

  it('keeps a task with a later start date out of the plain list and the Heute view', async () => {
    await taskRepo.create({
      ...base,
      title: 'Noch nicht dran',
      dueDate: '2026-11-03',
      startDate: '2026-11-08',
    });
    const { unmount } = draw('/todos');
    await waitFor(() => expect(screen.queryByText('Noch nicht dran')).toBeNull());
    unmount();
    draw('/todos?view=soon');
    expect(await screen.findByText('Noch nicht dran')).toBeVisible();
    expect(screen.getByText(/ab /)).toBeVisible();
  });

  it('filters by tag', async () => {
    await taskRepo.create({ ...base, title: 'Rasen mähen', tags: ['garten'] });
    await taskRepo.create({ ...base, title: 'Steuer', tags: ['papier'] });
    draw('/todos');
    expect(await screen.findByText('Steuer')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '#garten · 1' }));
    await waitFor(() => expect(screen.queryByText('Steuer')).toBeNull());
    expect(screen.getByText('Rasen mähen')).toBeVisible();
  });

  it('shows the progress of a project list', async () => {
    const project = await listRepo.create({ name: 'Umzug', order: 1, kind: 'project' });
    await taskRepo.create({ ...base, listId: project.id, title: 'Kartons', done: true });
    await taskRepo.create({ ...base, listId: project.id, title: 'Möbel' });
    draw(`/todos?list=${project.id}`);
    expect(await screen.findByText('1 von 2 erledigt')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Umzug' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
  });

  it('moves every overdue task to today in one step', async () => {
    // The calm default offers "Neu planen"; the plain wording has the one-step button.
    await patchFocusSettings({ calmAttention: false });
    await taskRepo.create({ ...base, title: 'Alt eins', dueDate: '2026-10-20' });
    await taskRepo.create({ ...base, title: 'Alt zwei', dueDate: '2026-10-25' });
    draw('/todos');
    await userEvent.click(await screen.findByTestId('all-today'));
    await waitFor(async () => {
      const due = (await taskRepo.active().toArray()).map((x) => x.dueDate);
      expect(due).toEqual(['2026-11-03', '2026-11-03']);
    });
  });
});

describe('ToDos board', () => {
  it('has four columns and moves a card from its menu', async () => {
    await taskRepo.create({ ...base, title: 'Ohne Datum' });
    draw('/todos?view=board');
    await screen.findByText('Ohne Datum');
    const someday = screen.getByRole('region', { name: 'Irgendwann' });
    expect(within(someday).getByText('Ohne Datum')).toBeVisible();
    for (const name of ['Heute', 'Demnächst', 'Irgendwann', 'Erledigt'])
      expect(screen.getByRole('region', { name })).toBeVisible();
    await userEvent.click(within(someday).getByRole('button', { name: 'Weitere Optionen' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Verschieben nach Heute' }));
    await waitFor(async () =>
      expect((await taskRepo.active().toArray())[0]?.plannedFor).toBe('2026-11-03'),
    );
    const today = screen.getByRole('region', { name: 'Heute' });
    await waitFor(() => expect(within(today).getByText('Ohne Datum')).toBeVisible());
  });

  it('ticks a card off when it goes to Erledigt', async () => {
    const task = await taskRepo.create({ ...base, title: 'Fertig machen', dueDate: '2026-11-03' });
    draw('/todos?view=board');
    await screen.findByText('Fertig machen');
    const today = screen.getByRole('region', { name: 'Heute' });
    await userEvent.click(within(today).getByRole('button', { name: 'Weitere Optionen' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Verschieben nach Erledigt' }),
    );
    await waitFor(async () => expect((await taskRepo.get(task.id))?.done).toBe(true));
  });
});

describe('Heute card', () => {
  const task = (over: Record<string, unknown>) =>
    ({ id: 'x', createdAt: 1, ...base, title: 'T', ...over }) as never;

  it('counts what is on today, sums the estimate and names the next task', () => {
    render(
      <TodayCard
        day="2026-11-03"
        tasks={[
          task({ id: 'a', title: 'Anruf', dueDate: '2026-11-03', estimateMin: 15 }),
          task({ id: 'b', title: 'Bericht', plannedFor: '2026-11-03', estimateMin: 30 }),
          task({ id: 'c', title: 'Später', dueDate: '2026-11-20' }),
        ]}
      />,
    );
    expect(screen.getByTestId('today-count')).toHaveTextContent('2');
    expect(screen.getByTestId('today-count')).toHaveTextContent('etwa 45 Min');
    expect(screen.getByText(/Als Nächstes: /)).toBeVisible();
  });

  it('says so calmly when nothing is left for today', () => {
    render(<TodayCard day="2026-11-03" tasks={[task({ dueDate: '2026-11-20' })]} />);
    expect(screen.getByText('Alles für heute erledigt.')).toBeVisible();
  });
});
