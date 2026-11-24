// @vitest-environment jsdom
/**
 * „Im Plan · Mi“ on a routine (planner hub 2, 10b): its turn (due today) is planned as `<id>:<due>` on Wednesday; the
 * row and the dialog show it.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { RoutineEditor } from '../components/RoutineEditor';
import { routineRepo } from '../repo';
import RoutinesPage from '../routes/RoutinesPage';

const assignments = createCollectionRepo(getManifest('planner')!, 'assignment');

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 16, 10, 0).getTime()); // Monday
  for (const t of ['routines_routine', 'planner_assignment', 'planner_item', '_modules', '_links'])
    await db.table(t).clear();
  await db.table('_modules').put({
    id: 'planner',
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

it('a turn placed on Wednesday reads „Im Plan · Mi“ on the row and in the dialog, linking to its occurrence row', async () => {
  const r = await routineRepo.create({
    name: 'Bad putzen',
    repeat: { freq: 'weekly', interval: 1 },
    startDate: '2026-11-16',
    dueDate: '2026-11-16',
    people: [],
    turn: 0,
  });
  await assignments.create(
    {
      itemKey: `routines:${r.id}:2026-11-16`,
      k: 0,
      of: 1,
      date: '2026-11-18',
      minutes: 30,
      order: 0,
      reason: 'new',
    },
    { id: `routines:${r.id}:2026-11-16#0` },
  );
  const page = render(
    <MemoryRouter>
      <RoutinesPage />
    </MemoryRouter>,
  );
  const mark = await screen.findByRole(
    'link',
    { name: 'Im Plan · Mi – Mittwoch, 18. November. Im Planer zeigen' },
    { timeout: 5000 },
  );
  expect(mark).toHaveAttribute(
    'href',
    `/planner?day=2026-11-18&item=${encodeURIComponent(`routines:${r.id}:2026-11-16`)}`,
  );
  page.unmount();
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <RoutineEditor target={r} rooms={[]} onClose={onClose} />
    </MemoryRouter>,
  );
  (await screen.findByRole('link', { name: /^Im Plan · Mi/ }, { timeout: 5000 })).click();
  expect(onClose).toHaveBeenCalled();
});
