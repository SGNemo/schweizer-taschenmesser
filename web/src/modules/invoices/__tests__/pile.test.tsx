// @vitest-environment jsdom
/**
 * Open invoices as a part of „Finanzen checken“ (planner hub 2, package 2): this module's own data only, keys and a
 * fixed route – never a payee or a sum; the jump `?view=open` writes nothing and leaves the URL.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import source, { OPEN_ROUTE } from '../pile';
import { invoiceRepo } from '../repo';
import InvoicesPage from '../routes/InvoicesPage';

const add = (over: Record<string, unknown>) =>
  invoiceRepo.create({ payee: 'Stadtwerke', amountMinor: 8430, status: 'open', ...over } as never);

beforeEach(async () => {
  await db.table('invoices_invoice').clear();
  setNow(() => new Date(2026, 10, 30, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('the invoices part', () => {
  it('names the open invoices in the planned days (late ones too) by key; no payee, no sum', async () => {
    const late = await add({ dueDate: '2026-11-20' });
    const soon = await add({ dueDate: '2026-12-04' });
    await add({ dueDate: '2027-02-01' });
    await add({ dueDate: '2026-12-02', status: 'paid' });
    const [part] = await source({ today: '2026-11-30', until: '2026-12-13' });
    expect(part).toMatchObject({ area: 'money', count: 0, to: OPEN_ROUTE });
    expect(new Set(part?.members)).toEqual(new Set([`invoices:${late.id}`, `invoices:${soon.id}`]));
    expect(JSON.stringify(part)).not.toMatch(/Stadtwerke|84,30|8430/);
    expect(OPEN_ROUTE).toBe('/invoices?view=open');
  });

  it('`?view=open` shows the open invoices, writes nothing and leaves the URL', async () => {
    await add({ dueDate: '2026-12-04' });
    const before = JSON.stringify(await db.table('invoices_invoice').toArray());
    function Where() {
      return <output data-testid="search">{useLocation().search}</output>;
    }
    render(
      <MemoryRouter initialEntries={['/invoices?view=open']}>
        <InvoicesPage />
        <Where />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(JSON.stringify(await db.table('invoices_invoice').toArray())).toBe(before);
  });
});
