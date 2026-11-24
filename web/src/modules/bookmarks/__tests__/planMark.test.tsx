// @vitest-environment jsdom
/**
 * The shared plan mark in the Merkliste (planner hub 2, package 10b): a row reads the planner – an entry placed from
 * the planner's side shows „Im Plan · Mi“ – and `inPlan` stays the module's request, read as the fallback (M3) while
 * the planner has no row. Done entries and the permanent links have none. Drawing writes nothing.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { itemRepo } from '../repo';
import BookmarksPage from '../routes/BookmarksPage';

const assignments = createCollectionRepo(getManifest('planner')!, 'assignment');
const create = (over: Record<string, unknown>) =>
  itemRepo.create({
    title: 'x',
    kind: 'read',
    tags: [],
    done: false,
    started: false,
    ...over,
  } as never);

const snapshot = async () =>
  JSON.stringify(
    await Promise.all(
      db.tables.filter((x) => x.name !== '_meta').map(async (x) => [x.name, await x.toArray()]),
    ),
  );

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 16, 10, 0).getTime()); // Monday 2026-11-16
  for (const name of ['bookmarks_item', 'planner_assignment', 'planner_item', '_modules'])
    await db.table(name).clear();
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
afterEach(() => {
  cleanup();
  setNow();
});

describe('Merkliste: the plan mark', () => {
  it('M1 from the planner, M3 from `inPlan`, none for a done entry; the mark is no part of the row link; nothing written', async () => {
    const placed = await create({ title: 'Fahrradträger', kind: 'try' });
    await assignments.create(
      {
        itemKey: `bookmarks:${placed.id}`,
        k: 0,
        of: 1,
        date: '2026-11-18',
        minutes: 30,
        order: 0,
        reason: 'new',
      },
      { id: `bookmarks:${placed.id}#0` },
    );
    await create({ title: 'Dune', kind: 'watch', inPlan: true });
    await create({ title: 'Erledigt', kind: 'read', inPlan: true, done: true });
    const before = await snapshot();
    render(
      <MemoryRouter initialEntries={['/bookmarks']}>
        <BookmarksPage />
      </MemoryRouter>,
    );
    const day = await screen.findByRole('link', { name: /^Im Plan · Mi – / });
    expect(day).toHaveAttribute(
      'href',
      `/planner?day=2026-11-18&item=${encodeURIComponent(`bookmarks:${placed.id}`)}`,
    );
    expect(day.closest('li')).toHaveTextContent('Fahrradträger');
    expect(day.closest('button, a[data-row]')).toBeNull();
    const waits = screen.getByRole('link', { name: /^Im Plan · noch ohne Tag/ });
    expect(waits.closest('li')).toHaveTextContent('Dune');
    await waitFor(() => expect(screen.getAllByTestId('plan-mark')).toHaveLength(2));
    const done = screen.queryByText('Erledigt')?.closest('li');
    if (done) expect(within(done).queryByTestId('plan-mark')).toBeNull();
    expect(await snapshot()).toBe(before);
  });
});
