// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
import { TaskEditor } from '../components/TaskEditor';
import { taskRepo } from '../repo';

beforeEach(async () => {
  await db.table('todos_task').clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const base = { listId: 'inbox', title: 'Team-Sachen lesen', done: false, priority: 0, order: 0 };
const editor = (task: Awaited<ReturnType<typeof taskRepo.create>>) => (
  <MemoryRouter>
    <TaskEditor task={task} subtasks={[]} lists={[]} onClose={() => {}} />
  </MemoryRouter>
);

// Package 5b: „Erinnern: 1 Std vorher“ is offered only for a deadline with an hour and is off until switched on.
it('no hour, no reminder switch', async () => {
  render(editor(await taskRepo.create({ ...base, dueDate: '2026-11-15' })));
  expect(await screen.findByLabelText('Uhrzeit der Frist (optional)')).toBeTruthy();
  expect(screen.queryByRole('switch', { name: /Erinnern: 1 Std vorher/ })).toBeNull();
});

it('with an hour the switch is off by default and saves the opt-in', async () => {
  const task = await taskRepo.create({ ...base, dueDate: '2026-11-15', dueTime: '18:00' });
  render(editor(task));
  const sw = await screen.findByRole('switch', { name: /Erinnern: 1 Std vorher/ });
  expect(sw.getAttribute('aria-checked')).toBe('false');
  await userEvent.click(sw);
  await userEvent.click(screen.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }));
  await waitFor(async () => expect((await taskRepo.get(task.id))?.dueRemind).toBe(true));
  expect((await taskRepo.get(task.id))?.dueTime).toBe('18:00');
});

it('switched on without the system permission: one calm line, „Erlauben“ only while it can still be asked', async () => {
  const perm = vi.spyOn(getPlatform().notifications, 'permission').mockReturnValue('default');
  render(editor(await taskRepo.create({ ...base, dueDate: '2026-11-15', dueTime: '18:00' })));
  expect(screen.queryByTestId('due-permission-hint')).toBeNull();
  await userEvent.click(await screen.findByRole('switch', { name: /Erinnern: 1 Std vorher/ }));
  expect((await screen.findByTestId('due-permission-hint')).textContent).toMatch(
    /noch nicht erlaubt/,
  );
  expect(screen.getByRole('button', { name: 'Erlauben' })).toBeTruthy();
  cleanup();
  perm.mockReturnValue('denied');
  render(
    editor(
      await taskRepo.create({ ...base, dueDate: '2026-11-15', dueTime: '18:00', dueRemind: true }),
    ),
  );
  expect((await screen.findByTestId('due-permission-hint')).textContent).toMatch(/blockiert/);
  expect(screen.queryByRole('button', { name: 'Erlauben' })).toBeNull();
});
