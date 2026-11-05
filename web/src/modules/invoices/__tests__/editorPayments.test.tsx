// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setNow } from '@/core/time/now';
import { invoiceRepo } from '../repo';
import InvoicesPage from '../routes/InvoicesPage';

beforeEach(async () => {
  bus.clear();
  await db.table('invoices_invoice').clear();
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

async function openInvoice(payee: string) {
  const inv = await invoiceRepo.create({
    payee,
    amountMinor: 30000,
    dueDate: '2026-11-20',
    status: 'open',
  });
  render(
    <MemoryRouter initialEntries={['/invoices']}>
      <InvoicesPage />
    </MemoryRouter>,
  );
  await userEvent.click(await screen.findByText(payee));
  return inv;
}

// QA round 4, X02: "Speichern" wrote the payments of the moment the dialog opened.
it('a part payment added in the dialog survives "Speichern"', async () => {
  const inv = await openInvoice('Zahnarzt');
  await userEvent.type(await screen.findByLabelText('Gezahlte Summe'), '100');
  await userEvent.click(screen.getByRole('button', { name: 'Teilzahlung erfassen' }));
  await waitFor(async () => expect((await invoiceRepo.get(inv.id))?.payments?.length).toBe(1));
  await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
  await waitFor(() => expect(screen.queryByLabelText('Gezahlte Summe')).toBeNull());
  expect((await invoiceRepo.get(inv.id))?.payments?.map((p) => p.amountMinor)).toEqual([10000]);
});

// QA round 4, X03: Enter in the payment field submitted the whole invoice form.
it('Enter in "Gezahlte Summe" adds the part payment and keeps the dialog open', async () => {
  const inv = await openInvoice('Werkstatt');
  await userEvent.type(await screen.findByLabelText('Gezahlte Summe'), '50{Enter}');
  await waitFor(async () => expect((await invoiceRepo.get(inv.id))?.payments?.length).toBe(1));
  expect(screen.getByLabelText('Gezahlte Summe')).toBeTruthy();
});
