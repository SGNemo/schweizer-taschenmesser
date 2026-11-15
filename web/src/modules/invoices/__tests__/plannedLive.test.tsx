// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { addLink } from '@/core/entitylinks';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import InvoicesPage from '../routes/InvoicesPage';
import { invoiceRepo } from '../repo';

/**
 * „Im Plan“ on the invoice page follows the planner while the page is open (planner hub S1, step 4). A late
 * invoice has no planned day („Frist vorbei“, R2); a noted reminder with a new deadline brings it back, and the
 * planner's run places it after the page has already rendered. The fact must appear then, without a reload
 * (the query is a native async function, docs/howto/gotchas.md „`liveQuery` needs an `async` function“).
 */
const assignments = createCollectionRepo(getManifest('planner')!, 'assignment');

beforeEach(async () => {
  for (const name of ['invoices_invoice', '_links', '_modules', 'planner_assignment'])
    await db.table(name).clear();
  await db.table('_modules').put({
    id: 'planner',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'test',
    deletedAt: null,
    _f: {},
  });
  setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('„Im Plan“ on the invoice page', () => {
  it('appears when the planner places the invoice while the page is open', async () => {
    const i = await invoiceRepo.create({
      payee: 'Stadtwerke',
      amountMinor: 8430,
      dueDate: '2026-09-17',
      dunnedDueDate: '2026-11-20',
      dunningLevel: 1,
      dunnedAt: '2026-09-28',
      status: 'open',
    } as never);
    await addLink({
      from: { module: 'invoices', id: i.id },
      to: { module: 'mail', id: 'thr-dun-1' },
      rel: 'dunning',
      label: 'Zahlungserinnerung',
      on: '2026-09-28',
    });
    render(
      <MemoryRouter initialEntries={[`/invoices?open=${i.id}`]}>
        <InvoicesPage />
      </MemoryRouter>,
    );
    const facts = await screen.findByTestId('invoice-links');
    // Not placed yet: no „Im Plan“.
    expect(within(facts).queryByTestId('invoice-planned')).toBeNull();

    // The planner's run places it on today.
    const key = `invoices:${i.id}`;
    await assignments.create(
      { itemKey: key, k: 0, of: 1, date: '2026-09-29', minutes: 10, order: 0, reason: 'new' },
      { id: `${key}#0@2026-09-29` },
    );
    const planned = await within(await screen.findByTestId('invoice-links')).findByTestId(
      'invoice-planned',
    );
    expect(planned).toHaveAttribute('href', '/planner?day=2026-09-29');
  });
});
