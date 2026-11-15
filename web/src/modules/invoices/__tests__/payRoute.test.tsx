// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { addLink } from '@/core/entitylinks';
import { bus } from '@/core/events';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import InvoicesPage from '../routes/InvoicesPage';
import { invoiceRepo } from '../repo';

/**
 * Planner hub S1, L7 (docs/design/planner-hub/CONCEPT-LINKS.md §2): `?open=<id>&do=pay` is untrusted input.
 * It may open the invoice's own pay step and nothing else: no write, no event, until the person confirms.
 */
const add = (over: Record<string, unknown> = {}) =>
  invoiceRepo.create({
    payee: 'Stadtwerke',
    amountMinor: 8430,
    dueDate: '2026-11-02',
    status: 'open',
    ...over,
  } as never);

function Where() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}
const open = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <InvoicesPage />
      <Where />
    </MemoryRouter>,
  );

/** Everything a payment could touch, as stored. */
const snapshot = async () =>
  JSON.stringify(
    await Promise.all(
      db.tables
        .filter((x) => !['_meta'].includes(x.name))
        .map(async (x) => [x.name, await x.toArray()]),
    ),
  );
const events: string[] = [];
const stripped = () => waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));

beforeEach(async () => {
  bus.clear();
  events.length = 0;
  for (const name of ['invoice.paid', 'invoice.payment', 'invoice.unpaid'] as const)
    bus.on(name, () => {
      events.push(name);
    });
  await db.table('invoices_invoice').clear();
  await db.table('_links').clear();
  useUiStore.setState({ toasts: [] });
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('`?open=<id>&do=pay`', () => {
  it('opens the pay step of that invoice and writes nothing; both parameters leave the URL', async () => {
    const i = await add();
    const before = await snapshot();
    open(`/invoices?open=${i.id}&do=pay`);
    const dialog = await screen.findByRole('dialog', { name: 'Stadtwerke bezahlt?' });
    expect(within(dialog).getByTestId('pay-step-open')).toHaveTextContent(/84,30/);
    await stripped();
    expect(await snapshot()).toBe(before);
    expect(events).toEqual([]);
    expect((await invoiceRepo.get(i.id))?.status).toBe('open');

    // Leaving the step writes nothing either.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(await snapshot()).toBe(before);
    expect(events).toEqual([]);
  });

  it('only the person’s „Bezahlt“ pays: with the day, and the toast carries the undo', async () => {
    const i = await add();
    open(`/invoices?open=${i.id}&do=pay`);
    const dialog = await screen.findByRole('dialog', { name: 'Stadtwerke bezahlt?' });
    await userEvent.click(within(dialog).getByTestId('pay-step-confirm'));
    await waitFor(async () =>
      expect(await invoiceRepo.get(i.id)).toMatchObject({ status: 'paid', paidAt: '2026-11-05' }),
    );
    expect(events).toEqual(['invoice.paid']);
    const toast = useUiStore.getState().toasts.at(-1)!;
    expect(toast.message).toBe('Als bezahlt markiert.');
    toast.action!.run();
    await waitFor(async () => expect((await invoiceRepo.get(i.id))?.status).toBe('open'));
  });

  it('less than what is open is a part payment, never „paid“', async () => {
    const i = await add();
    open(`/invoices?open=${i.id}&do=pay`);
    const dialog = await screen.findByRole('dialog', { name: 'Stadtwerke bezahlt?' });
    const amount = within(dialog).getByLabelText(/Gezahlte Summe/);
    await userEvent.clear(amount);
    await userEvent.type(amount, '10');
    await userEvent.click(within(dialog).getByTestId('pay-step-confirm'));
    await waitFor(async () => expect((await invoiceRepo.get(i.id))?.payments).toHaveLength(1));
    expect(await invoiceRepo.get(i.id)).toMatchObject({
      status: 'open',
      payments: [{ amountMinor: 1000 }],
    });
  });

  it('an unknown, deleted or malformed id opens nothing and writes nothing', async () => {
    const gone = await add({ payee: 'Gelöscht' });
    await invoiceRepo.remove(gone.id);
    await add();
    const before = await snapshot();
    for (const id of ['nope', gone.id, '../x', '%00', '']) {
      open(`/invoices?open=${encodeURIComponent(id)}&do=pay`);
      await stripped();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(await snapshot()).toBe(before);
      cleanup();
    }
    expect(events).toEqual([]);
  });

  it('`do` alone, or any other value, does nothing of its own: the invoice just opens as with `?open=`', async () => {
    const i = await add();
    const before = await snapshot();
    open('/invoices?do=pay');
    await stripped();
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();

    for (const value of ['delete', 'markPaid', 'PAY', 'pay&x=1']) {
      open(`/invoices?open=${i.id}&do=${encodeURIComponent(value)}`);
      // The plain open: the invoice's own dialog, not the pay step.
      const dialog = await screen.findByRole('dialog', { name: 'Rechnung bearbeiten' });
      expect(dialog).toBeVisible();
      expect(screen.queryByRole('dialog', { name: 'Stadtwerke bezahlt?' })).toBeNull();
      await stripped();
      cleanup();
    }
    expect(await snapshot()).toBe(before);
    expect(events).toEqual([]);
  });

  it('a paid invoice has no pay step: `do=pay` opens it as usual and writes nothing', async () => {
    const i = await add({ status: 'paid', paidAt: '2026-11-01' });
    const before = await snapshot();
    open(`/invoices?open=${i.id}&do=pay`);
    expect(await screen.findByRole('dialog', { name: 'Rechnung bearbeiten' })).toBeVisible();
    await stripped();
    expect(await snapshot()).toBe(before);
    expect(events).toEqual([]);
  });
});

describe('the invoice says where it came from (step 4)', () => {
  it('„Aus Mail“ and „Mahnung aus Mail vom 3. Nov.“ with the subject of the time; no link, no extra line', async () => {
    const plain = await add({ payee: 'Vermieter' });
    const i = await add();
    await addLink({
      from: { module: 'invoices', id: i.id },
      to: { module: 'mail', id: 'thr-bill-1' },
      rel: 'origin',
      label: 'Ihre Rechnung für Oktober',
      on: '2026-10-20',
    });
    await addLink({
      from: { module: 'invoices', id: i.id },
      to: { module: 'mail', id: 'thr-dun-2' },
      rel: 'dunning',
      label: 'Zahlungserinnerung',
      on: '2026-11-03',
    });
    open(`/invoices?open=${i.id}`);
    const facts = await screen.findByTestId('invoice-links');
    expect(facts).toHaveTextContent('Aus Mail');
    expect(facts).toHaveTextContent('Ihre Rechnung für Oktober');
    expect(facts).toHaveTextContent('Mahnung aus Mail vom 3. Nov.');
    expect(facts).toHaveTextContent('Zahlungserinnerung');
    // The mail module is not on this device (desktop only): the way out is the web mail, on a tap.
    expect(within(facts).getAllByRole('button', { name: 'Im Browser öffnen' })).toHaveLength(2);
    // The planner is off: no plan line.
    expect(within(facts).queryByTestId('invoice-planned')).toBeNull();
    cleanup();

    open(`/invoices?open=${plain.id}`);
    await screen.findByRole('dialog', { name: 'Rechnung bearbeiten' });
    expect(screen.queryByTestId('invoice-links')).toBeNull();
  });
});
