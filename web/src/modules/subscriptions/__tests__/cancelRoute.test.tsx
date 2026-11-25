// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import SubscriptionsPage from '../routes/SubscriptionsPage';
import { subscriptionRepo } from '../repo';

/**
 * Planner hub S2, L7 (docs/design/planner-hub/CONCEPT-LINKS.md §2): the plan row's „Kündigen …“ is
 * `?open=<id>&do=cancel`, untrusted input. Since planner hub 2, package 4b it opens the module's own cancel step (a
 * dialog; only its own taps write); nothing is written by the route, and both parameters leave the URL. Any other `do`
 * opens the subscription as with `?open=`.
 */
const add = (over: Record<string, unknown> = {}) =>
  subscriptionRepo.create({
    name: 'Zeitung',
    amountMinor: 9900,
    startDate: '2025-11-20',
    recurrence: { freq: 'yearly' },
    cancelNoticeDays: 7,
    active: true,
    ...over,
  } as never);

function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}
const open = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SubscriptionsPage />
      <Where />
    </MemoryRouter>,
  );
const snapshot = async () =>
  JSON.stringify(
    await Promise.all(
      db.tables.filter((x) => x.name !== '_meta').map(async (x) => [x.name, await x.toArray()]),
    ),
  );
const stripped = () => waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));

beforeEach(async () => {
  await db.table('subscriptions_subscription').clear();
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('`?open=<id>&do=cancel`', () => {
  it('opens the cancel step and writes nothing; both parameters leave the URL', async () => {
    const s = await add();
    const before = await snapshot();
    open(`/subscriptions?open=${s.id}&do=cancel`);
    // Since planner hub 2, package 4b: the module's own cancel step (only its own taps write).
    expect(await screen.findByRole('dialog', { name: 'Zeitung kündigen?' })).toBeVisible();
    await stripped();
    expect(await snapshot()).toBe(before);
    expect(await subscriptionRepo.get(s.id)).toMatchObject({ active: true });
    expect((await subscriptionRepo.get(s.id))?.recurrence.until).toBeUndefined();
  });

  it('an unknown or malformed id opens nothing; `do` alone or another value does nothing of its own', async () => {
    const s = await add();
    const before = await snapshot();
    for (const id of ['nope', '../x', '%00', '']) {
      open(`/subscriptions?open=${encodeURIComponent(id)}&do=cancel`);
      await stripped();
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();
    }
    open('/subscriptions?do=cancel');
    await stripped();
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    for (const value of ['delete', 'pause', 'CANCEL']) {
      open(`/subscriptions?open=${s.id}&do=${encodeURIComponent(value)}`);
      expect(await screen.findByRole('dialog', { name: 'Abo bearbeiten' })).toBeVisible();
      await stripped();
      cleanup();
    }
    expect(await snapshot()).toBe(before);
    // Eight renders of the page in a row.
  }, 20_000);
});
