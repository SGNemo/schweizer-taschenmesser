// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { TaskEditor } from '../components/TaskEditor';
import { taskRepo } from '../repo';

beforeEach(async () => {
  await db.table('todos_task').clear();
});
afterEach(cleanup);

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
