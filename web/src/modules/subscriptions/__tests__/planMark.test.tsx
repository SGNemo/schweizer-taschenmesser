// @vitest-environment jsdom
/**
 * The shared plan mark in Abos (planner hub 2, package 10b): the row and the dialog read the planner – a deadline
 * placed from the planner's side (an occurrence key) shows „Im Plan · Mi“ – and `plannedDeadline` stays what it is,
 * the module's request: its fallback (M3) while the planner has no row. Drawing writes nothing.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { subscriptionRepo } from '../repo';
import SubscriptionsPage from '../routes/SubscriptionsPage';

const assignments = createCollectionRepo(getManifest('planner')!, 'assignment');

const add = (over: Record<string, unknown> = {}) =>
  subscriptionRepo.create({
    name: 'Zeitung',
    amountMinor: 1200,
    startDate: '2026-01-25',
    recurrence: { freq: 'monthly' },
    cancelNoticeDays: 7,
    active: true,
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
  for (const name of [
    'subscriptions_subscription',
    'planner_assignment',
    'planner_item',
    '_modules',
  ])
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

describe('Abos: the plan mark', () => {
  it('a deadline placed from the planner shows M1 on the row and in the dialog; nothing is written', async () => {
    const s = await add();
    await assignments.create(
      {
        itemKey: `subscriptions:${s.id}:2026-11-18`,
        k: 0,
        of: 1,
        date: '2026-11-18',
        minutes: 15,
        order: 0,
        reason: 'new',
      },
      { id: `subscriptions:${s.id}:2026-11-18#0` },
    );
    const before = await snapshot();
    render(
      <MemoryRouter initialEntries={[`/subscriptions?open=${s.id}`]}>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Abo bearbeiten' });
    const inDialog = await within(dialog).findByRole('link', { name: /^Im Plan · Mi – / });
    expect(inDialog).toHaveAttribute(
      'href',
      `/planner?day=2026-11-18&item=${encodeURIComponent(`subscriptions:${s.id}:2026-11-18`)}`,
    );
    expect(inDialog).toHaveAccessibleName(
      'Im Plan · Mi – Mittwoch, 18. November. Im Planer zeigen',
    );
    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /^Im Plan · Mi – / })).toHaveLength(2),
    );
    expect(await snapshot()).toBe(before);
  });

  it('`plannedDeadline` is the fallback (M3) while the planner has no row; off → no mark', async () => {
    const s = await add({ plannedDeadline: '2026-11-18' });
    const view = render(
      <MemoryRouter initialEntries={['/subscriptions']}>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    const mark = await screen.findByRole('link', { name: /^Im Plan · noch ohne Tag/ });
    expect(mark).toHaveAttribute(
      'href',
      `/planner?item=${encodeURIComponent(`subscriptions:${s.id}`)}`,
    );
    // The field stays as it was.
    expect((await subscriptionRepo.get(s.id))?.plannedDeadline).toBe('2026-11-18');
    view.unmount();
    await db.table('_modules').update('planner', { enabled: false });
    render(
      <MemoryRouter initialEntries={['/subscriptions']}>
        <SubscriptionsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Zeitung')).toBeVisible();
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByRole('link', { name: /^Im Plan/ })).toBeNull();
  });
});
