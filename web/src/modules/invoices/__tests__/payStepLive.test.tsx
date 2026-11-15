// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { markPaid } from '../actions';
import InvoicesPage from '../routes/InvoicesPage';
import { invoiceRepo } from '../repo';

/**
 * Planner hub S1 follow-up: the pay step follows the invoice live. Paid or deleted elsewhere while it is open,
 * it writes nothing, closes and says so calmly; a toast never claims a write that did not happen.
 */
const add = () =>
  invoiceRepo.create({
    payee: 'Stadtwerke',
    amountMinor: 8430,
    dueDate: '2026-11-02',
    status: 'open',
  } as never);

const events: string[] = [];
const toasts = () => useUiStore.getState().toasts;
const openStep = async (id: string) => {
  render(
    <MemoryRouter initialEntries={[`/invoices?open=${id}&do=pay`]}>
      <InvoicesPage />
    </MemoryRouter>,
  );
  return screen.findByRole('dialog', { name: 'Stadtwerke bezahlt?' });
};
const closed = () =>
  waitFor(() => expect(screen.queryByRole('dialog', { name: 'Stadtwerke bezahlt?' })).toBeNull());
const partAmount = async (dialog: HTMLElement, value: string) => {
  const amount = within(dialog).getByLabelText(/Gezahlte Summe/);
  await userEvent.clear(amount);
  await userEvent.type(amount, value);
};

beforeEach(async () => {
  bus.clear();
  events.length = 0;
  for (const name of [
    'invoice.paid',
    'invoice.payment',
    'invoice.unpaid',
    'invoice.paymentRemoved',
  ] as const)
    bus.on(name, () => {
      events.push(name);
    });
  await db.table('invoices_invoice').clear();
  useUiStore.setState({ toasts: [] });
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setNow();
});

describe('pay step on an invoice paid elsewhere', () => {
  it('paid elsewhere while open: the step closes with „Schon bezahlt.“; paidAt, events and undo untouched', async () => {
    const i = await add();
    await openStep(i.id);
    await markPaid(i.id, '2026-11-01');
    await closed();
    expect(await invoiceRepo.get(i.id)).toMatchObject({ status: 'paid', paidAt: '2026-11-01' });
    expect(events).toEqual(['invoice.paid']);
    expect(toasts().map((x) => x.message)).toEqual(['Schon bezahlt.']);
    expect(toasts()[0]!.action).toBeUndefined();
  });

  it('full payment racing a payment elsewhere: the re-check writes nothing and offers no undo', async () => {
    const i = await add();
    const dialog = await openStep(i.id);
    const paid = {
      ...(await invoiceRepo.get(i.id))!,
      status: 'paid' as const,
      paidAt: '2026-11-01',
    };
    vi.spyOn(invoiceRepo, 'get').mockResolvedValueOnce(paid);
    const update = vi.spyOn(invoiceRepo, 'update');
    await userEvent.click(within(dialog).getByTestId('pay-step-confirm'));
    await closed();
    expect(update).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    expect(toasts().map((x) => x.message)).toEqual(['Schon bezahlt.']);
    expect(toasts()[0]!.action).toBeUndefined();
  });

  it('part payment racing a payment elsewhere: no „Teilzahlung erfasst.“, nothing written', async () => {
    const i = await add();
    const dialog = await openStep(i.id);
    await partAmount(dialog, '10');
    const paid = {
      ...(await invoiceRepo.get(i.id))!,
      status: 'paid' as const,
      paidAt: '2026-11-01',
    };
    // The step's own re-check still sees it open; `addPayment` then finds it paid.
    const open = (await invoiceRepo.get(i.id))!;
    vi.spyOn(invoiceRepo, 'get')
      .mockResolvedValueOnce(open)
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(paid);
    await userEvent.click(within(dialog).getByTestId('pay-step-confirm'));
    await closed();
    vi.restoreAllMocks();
    expect((await invoiceRepo.get(i.id))?.payments).toBeUndefined();
    expect(events).toEqual([]);
    expect(toasts().map((x) => x.message)).toEqual(['Schon bezahlt.']);
  });
});

describe('pay step on an invoice deleted elsewhere', () => {
  it('deleted while open: the step closes with „Gibt es nicht mehr.“ and writes nothing', async () => {
    const i = await add();
    await openStep(i.id);
    await invoiceRepo.remove(i.id);
    await closed();
    expect(events).toEqual([]);
    expect(toasts().map((x) => x.message)).toEqual(['Gibt es nicht mehr.']);
  });

  it('deleted right before „Bezahlt“: no write, no rejection, a calm word', async () => {
    const i = await add();
    const dialog = await openStep(i.id);
    vi.spyOn(invoiceRepo, 'get').mockResolvedValueOnce(undefined);
    const update = vi.spyOn(invoiceRepo, 'update');
    await userEvent.click(within(dialog).getByTestId('pay-step-confirm'));
    await closed();
    expect(update).not.toHaveBeenCalled();
    expect(toasts().map((x) => x.message)).toEqual(['Gibt es nicht mehr.']);
  });

  it('a failing write is caught: the step closes and says it did not work', async () => {
    const i = await add();
    const dialog = await openStep(i.id);
    vi.spyOn(invoiceRepo, 'update').mockRejectedValueOnce(new Error('gone'));
    await userEvent.click(within(dialog).getByTestId('pay-step-confirm'));
    await closed();
    expect(events).toEqual([]);
    expect(toasts().map((x) => x.message)).toEqual([
      'Das hat nicht geklappt. Probier es noch einmal.',
    ]);
  });
});
