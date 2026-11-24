// @vitest-environment jsdom
/**
 * `?item=<rowKey>` (the mark „Im Plan · noch ohne Tag“, planner hub 2 package 10b): the page stays on „Plan“, the
 * folded group „Noch ohne Tag“ opens and the row gets the focus.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { assignmentRepo, itemRepo } from '../repo';
import PlannerPage from '../routes/PlannerPage';

const NOW = new Date(2026, 10, 9, 10, 0).getTime(); // Monday 2026-11-09
const taskRepo = createCollectionRepo(getManifest('todos')!, 'task');

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of ['planner_day', 'planner_item', 'planner_assignment', 'todos_task', '_meta'])
    await db.table(t).clear();
  await db.table('_modules').clear();
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
  useUiStore.setState({ closedGroups: [] });
});
afterEach(() => setNow());

it('`?item=` of a row without a day opens „Noch ohne Tag“ on the tab „Plan“ and focuses the row', async () => {
  const placed = await taskRepo.create({
    listId: 'inbox',
    title: 'Steuer',
    done: false,
    priority: 2,
    order: 0,
    estimateMin: 30,
  });
  await assignmentRepo.upsert(`todos:${placed.id}#0`, {
    itemKey: `todos:${placed.id}`,
    k: 0,
    of: 1,
    date: '2026-11-09',
    minutes: 30,
    order: 0,
    reason: 'new',
  });
  const waiting = await taskRepo.create({
    listId: 'inbox',
    title: 'Keller',
    done: false,
    priority: 0,
    order: 0,
  });
  // A row of the folded group „Noch ohne Tag“ (here one left out with „Nicht planen“, as in `page.test.tsx`).
  await itemRepo.upsert(`todos:${waiting.id}`, {
    source: { module: 'todos', id: waiting.id },
    excluded: true,
    order: 0,
  });
  render(
    <MemoryRouter initialEntries={[`/planner?item=${encodeURIComponent(`todos:${waiting.id}`)}`]}>
      <PlannerPage />
    </MemoryRouter>,
  );
  await screen.findByRole('group', { name: 'Woche' }, { timeout: 5000 });
  const toggle = await screen.findByRole('button', { name: /Noch ohne Tag/ }, { timeout: 5000 });
  await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'true'));
  const row = document.querySelector<HTMLElement>(`[data-row-key="todos:${waiting.id}"]`)!;
  expect(row.closest('[hidden]')).toBeNull();
  await waitFor(() => expect(row.querySelector('[data-row]')).toHaveFocus());
  // Still the tab „Plan“: the day's sheet is there.
  expect(screen.getByTestId('day-2026-11-09')).toBeInTheDocument();
});
