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

// QA round 4, X01: the editor wrote back every field as it was when it opened, so a change made
// meanwhile in another tab (or arriving by sync) was silently undone.
it('saving the editor keeps a title changed elsewhere while it was open', async () => {
  const task = await taskRepo.create({
    listId: 'inbox',
    title: 'Steuererklärung',
    done: false,
    priority: 0,
    order: 0,
  });
  const editor = (t: typeof task) => (
    <MemoryRouter>
      <TaskEditor task={t} subtasks={[]} lists={[]} onClose={() => {}} />
    </MemoryRouter>
  );
  const { rerender } = render(editor(task));
  // The other tab saves a new title; the page hands the live record to the open editor.
  rerender(editor(await taskRepo.update(task.id, { title: 'Titel aus Tab B' })));
  await userEvent.selectOptions(await screen.findByLabelText('Priorität'), '2');
  await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(async () => expect((await taskRepo.get(task.id))?.priority).toBe(2));
  expect((await taskRepo.get(task.id))?.title).toBe('Titel aus Tab B');
});
