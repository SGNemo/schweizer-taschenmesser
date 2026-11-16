// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { matchesQuery } from '../logic';
import { payManyWithUndo } from '../quickActions';
import { invoiceRepo } from '../repo';
import InvoicesPage from '../routes/InvoicesPage';

describe('matchesQuery', () => {
  const i = { payee: 'Stadtwerke Musterstadt', reference: 'SW-2026-11', note: 'Strom Oktober' };
  it('finds every word in payee, reference or note, any case', () => {
    expect(matchesQuery(i, '')).toBe(true);
    expect(matchesQuery(i, '  ')).toBe(true);
    expect(matchesQuery(i, 'stadtwerke')).toBe(true);
    expect(matchesQuery(i, 'sw-2026')).toBe(true);
    expect(matchesQuery(i, 'strom stadt')).toBe(true);
    expect(matchesQuery(i, 'strom gas')).toBe(false);
    expect(matchesQuery({ payee: 'Telekom' }, 'oktober')).toBe(false);
  });
});

const toastOf = () => useUiStore.getState().toasts.at(-1);

beforeEach(async () => {
  bus.clear();
  await db.table('invoices_invoice').clear();
  useUiStore.setState({ toasts: [] });
  setNow(() => new Date(2026, 10, 15, 10, 0).getTime());
});
afterEach(() => {
  cleanup();
  setNow();
});

const add = (payee: string, dueDate: string, extra: Record<string, unknown> = {}) =>
  invoiceRepo.create({ payee, amountMinor: 1000, dueDate, status: 'open', ...extra });

describe('payManyWithUndo', () => {
  it('pays every open one, names how many, and one undo reopens all of them', async () => {
    const a = await add('A', '2026-11-10');
    const b = await add('B', '2026-11-20');
    const c = await add('C', '2026-11-01', { status: 'paid', paidAt: '2026-11-02' });
    await payManyWithUndo([a.id, b.id, c.id]);
    expect((await invoiceRepo.get(a.id))?.status).toBe('paid');
    expect((await invoiceRepo.get(b.id))?.status).toBe('paid');
    // The already paid one keeps its own day.
    expect((await invoiceRepo.get(c.id))?.paidAt).toBe('2026-11-02');
    const toast = toastOf();
    expect(toast?.message).toBe('2 Rechnungen als bezahlt markiert.');
    toast?.action?.run();
    await waitFor(async () => {
      expect((await invoiceRepo.get(a.id))?.status).toBe('open');
      expect((await invoiceRepo.get(b.id))?.status).toBe('open');
    });
    expect((await invoiceRepo.get(c.id))?.status).toBe('paid');
  });
});

describe('payManyWithUndo with a series', () => {
  it('undo keeps an invoice of the series that was paid in the same batch', async () => {
    const a = await add('Miete', '2026-10-01', { repeat: 'monthly' });
    // The next one of the series exists already (created when "a" was paid once before) and is open.
    const b = await add('Miete', '2026-11-01', { repeat: 'monthly', repeatOf: a.id });
    await payManyWithUndo([a.id, b.id]);
    const created = (await invoiceRepo.active().toArray()).filter((i) => i.repeatOf === b.id);
    expect(created).toHaveLength(1);
    useUiStore.getState().toasts.at(-1)?.action?.run();
    await waitFor(async () => {
      expect((await invoiceRepo.get(a.id))?.status).toBe('open');
      expect((await invoiceRepo.get(b.id))?.status).toBe('open');
      // The one that paying "b" brought is gone again; "b" itself was never removed.
      expect((await invoiceRepo.active().toArray()).filter((i) => i.repeatOf === b.id)).toEqual([]);
    });
  });
});

const renderPage = async () => {
  render(
    <MemoryRouter initialEntries={['/invoices']}>
      <InvoicesPage />
    </MemoryRouter>,
  );
  await screen.findAllByText('Stadtwerke');
};

describe('invoice list tools', () => {
  beforeEach(async () => {
    await add('Stadtwerke', '2026-11-10', { reference: 'SW-1' });
    await add('Telekom', '2026-11-30', { note: 'Handy' });
    await add('Versicherung', '2026-12-20');
  });

  it('past-due invoices stand in their own area above the other groups', async () => {
    await renderPage();
    const late = screen.getByTestId('invoices-late');
    expect(within(late).getByRole('button', { name: 'Überfällig einklappen' })).toBeVisible();
    expect(late).toHaveTextContent('Stadtwerke');
    expect(late).not.toHaveTextContent('Telekom');
  });

  it('search filters by payee, reference and note, and says when nothing matches', async () => {
    await renderPage();
    const search = screen.getByRole('searchbox', { name: 'Rechnungen durchsuchen' });
    await userEvent.type(search, 'handy');
    expect(screen.getByText('Telekom')).toBeVisible();
    expect(screen.queryByText('Stadtwerke')).toBeNull();
    await userEvent.clear(search);
    await userEvent.type(search, 'gas');
    expect(screen.getByTestId('invoices-no-match')).toHaveTextContent(
      'Keine Rechnung passt zu „gas“.',
    );
    expect(screen.queryByTestId('invoices-empty')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Suche leeren' }));
    expect(screen.getByText('Versicherung')).toBeVisible();
  });

  it('"Auswählen" ticks rows; the bar marks them paid at once with one undo', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Auswählen' }));
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    await userEvent.click(boxes[0]!);
    await userEvent.click(boxes[1]!);
    const bar = screen.getByRole('region', { name: /Auswahl/ });
    expect(bar).toHaveTextContent('2');
    await userEvent.click(within(bar).getByRole('button', { name: 'Als bezahlt markieren' }));
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
    await waitFor(() => expect(toastOf()?.message).toBe('2 Rechnungen als bezahlt markiert.'));
    const open = (await invoiceRepo.active().toArray()).filter((i) => i.status === 'open');
    expect(open.map((i) => i.payee)).toEqual(['Versicherung']);
    await act(async () => {
      toastOf()?.action?.run();
    });
    await waitFor(async () =>
      expect(
        (await invoiceRepo.active().toArray()).filter((i) => i.status === 'open'),
      ).toHaveLength(3),
    );
  });

  it('a new search clears the ticks, and Esc ends the selection mode', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Auswählen' }));
    await userEvent.click(screen.getAllByRole('checkbox')[0]!);
    expect(screen.getByRole('region', { name: /Auswahl/ })).toHaveTextContent('1');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rechnungen durchsuchen' }), 'tele');
    expect(screen.queryByRole('region', { name: /Auswahl/ })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    await userEvent.click(document.body);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Auswählen' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
