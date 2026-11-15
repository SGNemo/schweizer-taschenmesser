// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setHideValues } from '@/core/focus/hideValues';
import { setNow } from '@/core/time/now';
import { invoiceRepo } from '../repo';
import InvoicesPage from '../routes/InvoicesPage';

beforeEach(async () => {
  bus.clear();
  await db.table('invoices_invoice').clear();
  await setHideValues(false);
  setNow(() => new Date(2026, 10, 15, 10, 0).getTime());
  await invoiceRepo.create({
    payee: 'Stadtwerke',
    amountMinor: 8990,
    dueDate: '2026-11-10',
    status: 'open',
  });
  await invoiceRepo.create({
    payee: 'Telekom',
    amountMinor: 3999,
    dueDate: '2026-11-30',
    status: 'open',
  });
  await invoiceRepo.create({
    payee: 'Hausverwaltung',
    amountMinor: 75000,
    dueDate: '2026-11-01',
    status: 'paid',
    paidAt: '2026-11-02',
  });
});
afterEach(async () => {
  cleanup();
  setNow();
  await setHideValues(false);
});

const openOverview = async () => {
  render(
    <MemoryRouter initialEntries={['/invoices']}>
      <InvoicesPage />
    </MemoryRouter>,
  );
  await screen.findByText('Stadtwerke');
  await userEvent.click(screen.getByRole('button', { name: 'Überblick' }));
  return screen.findByTestId('invoices-overview');
};

it('shows open, past due and paid this month, and no list', async () => {
  const ov = await openOverview();
  expect(within(ov).getByTestId('invoices-figure-open')).toHaveTextContent('129,89');
  expect(within(ov).getByTestId('invoices-figure-open')).toHaveTextContent('2 Rechnungen');
  const late = within(ov).getByTestId('invoices-figure-late');
  expect(late).toHaveTextContent('Frist vorbei');
  expect(late).toHaveTextContent('89,90');
  expect(late).toHaveTextContent('1 Rechnung');
  expect(within(ov).getByTestId('invoices-figure-paid')).toHaveTextContent('Bezahlt im November');
  expect(within(ov).getByTestId('invoices-figure-paid')).toHaveTextContent('750,00');
  // No rows: every "Stadtwerke" on the page is the donut's (legend, table).
  expect(screen.getAllByText('Stadtwerke').every((el) => ov.contains(el))).toBe(true);
});

it('the donut switches between open and paid, the month bars hold the paid sum', async () => {
  const ov = await openOverview();
  const donut = within(ov).getByTestId('invoices-donut');
  expect(donut).toHaveAccessibleName('Offen nach Empfänger');
  expect(within(donut).getByRole('table')).toHaveTextContent('Telekom');
  await userEvent.click(within(ov).getByRole('button', { name: 'Bezahlt (12 Monate)' }));
  const paid = within(ov).getByTestId('invoices-donut');
  expect(paid).toHaveAccessibleName('Bezahlt nach Empfänger, letzte 12 Monate');
  expect(within(paid).getByRole('table')).toHaveTextContent('Hausverwaltung');
  expect(within(paid).getByRole('table')).not.toHaveTextContent('Telekom');
  expect(within(within(ov).getByTestId('invoices-months')).getByRole('table')).toHaveTextContent(
    '750,00',
  );
});

it('"Werte ausblenden" hides every amount of the overview', async () => {
  await setHideValues(true);
  const ov = await openOverview();
  expect(ov).not.toHaveTextContent('89,90');
  expect(ov).not.toHaveTextContent('750,00');
  expect(within(ov).getByTestId('invoices-figure-late')).toHaveTextContent('1 Rechnung');
});
