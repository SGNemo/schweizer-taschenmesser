// @vitest-environment jsdom
/**
 * The invoice's plan panel (planner hub 2, package 4b, hand-off 04): the pay step as one line. Paying there writes
 * what the page's step writes – the invoice and the module's events – and nothing of the planner's (write spy); a
 * smaller sum is a part payment; „Werte ausblenden“ keeps the sum out of the panel and the toast; `compact` pays in
 * one tap; a reminder line when dunned; X3 for a foreign id.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { setHideValues } from '@/core/focus/hideValues';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { invoiceRepo } from '../repo';
import PlanPanel from '../components/PlanPanel';

const mod = (id: string) => ({
  id,
  enabled: true,
  dataPolicy: null,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 't',
  deletedAt: null,
  _f: {},
});

/** Every write in the database while it is on, by table. */
function writeSpy() {
  const writes: string[] = [];
  const off: (() => void)[] = [];
  for (const table of db.tables) {
    const hit = () => void writes.push(table.name);
    table.hook('creating', hit);
    table.hook('updating', hit);
    table.hook('deleting', hit);
    off.push(() => {
      table.hook('creating').unsubscribe(hit);
      table.hook('updating').unsubscribe(hit);
      table.hook('deleting').unsubscribe(hit);
    });
  }
  return { writes, stop: () => off.forEach((f) => f()) };
}

const add = (extra: Record<string, unknown> = {}) =>
  invoiceRepo.create(
    {
      payee: 'Stadtwerke',
      amountMinor: 8430,
      dueDate: '2026-11-12',
      status: 'open',
      ...extra,
    } as never,
    { id: 'inv1' },
  );

const panel = (id = 'inv1') =>
  render(
    <MemoryRouter>
      <PlanPanelHost moduleId="invoices" id={id} to={`/invoices?open=${id}`} />
    </MemoryRouter>,
  );

const events: string[] = [];
beforeEach(async () => {
  bus.clear();
  events.length = 0;
  for (const name of ['invoice.paid', 'invoice.payment'] as const)
    bus.on(name, () => {
      events.push(name);
    });
  for (const t of ['invoices_invoice', '_modules']) await db.table(t).clear();
  await db.table('_modules').bulkPut([mod('invoices'), mod('planner')]);
  await setHideValues(false);
  useUiStore.setState({ toasts: [] });
  setNow(() => new Date(2026, 10, 9, 10, 0).getTime());
});
afterEach(() => setNow());

describe('the invoice panel', () => {
  it('pays the whole rest as the page does – the invoice and its event, nothing of the planner', async () => {
    await add();
    panel();
    const sum = await screen.findByLabelText(/Gezahlte Summe/);
    // Filled once the switch „Werte ausblenden“ is read (off here), never for a moment before.
    await waitFor(() => expect((sum as HTMLInputElement).value).toBe('84,30'));
    expect(screen.getByLabelText(/Bezahlt am/)).toBeInTheDocument();
    // Nothing the row already says: no „Offen: …“ line.
    expect(screen.queryByTestId('pay-step-open')).toBeNull();
    const spy = writeSpy();
    fireEvent.click(screen.getByRole('button', { name: 'Bezahlt' }));
    await waitFor(async () => expect((await invoiceRepo.get('inv1'))?.status).toBe('paid'));
    spy.stop();
    expect(events).toContain('invoice.paid');
    expect(spy.writes.some((w) => w.startsWith('planner_'))).toBe(false);
    expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Als bezahlt markiert.');
    expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
  });

  it('a smaller sum is a part payment with its own undo', async () => {
    await add();
    panel();
    const sum = await screen.findByLabelText(/Gezahlte Summe/);
    fireEvent.change(sum, { target: { value: '30,00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bezahlt' }));
    await waitFor(async () => expect((await invoiceRepo.get('inv1'))?.payments?.length).toBe(1));
    expect((await invoiceRepo.get('inv1'))?.status).toBe('open');
    expect(useUiStore.getState().toasts.at(-1)?.action?.label).toBe('Rückgängig');
  });

  it('„Werte ausblenden“: no sum in the panel or the toast; an empty sum pays what is open', async () => {
    await setHideValues(true);
    await add();
    const { container } = panel();
    const sum = await screen.findByLabelText(/Gezahlte Summe/);
    await new Promise((r) => setTimeout(r, 100));
    expect((sum as HTMLInputElement).value).toBe('');
    expect(container.textContent).not.toMatch(/84,30/);
    fireEvent.click(screen.getByRole('button', { name: 'Bezahlt' }));
    await waitFor(async () => expect((await invoiceRepo.get('inv1'))?.status).toBe('paid'));
    expect(useUiStore.getState().toasts.at(-1)?.message).not.toMatch(/84/);
  });

  it('a dunned invoice says its reminder in one line', async () => {
    await add({ dunningLevel: 2, dunnedAt: '2026-11-04' });
    panel();
    expect(await screen.findByText(/^2\. Mahnung · 4\. Nov/)).toBeInTheDocument();
  });

  it('a foreign id: X3', async () => {
    panel('nope');
    expect(await screen.findByText('Gibt es nicht mehr.')).toBeInTheDocument();
  });

  it('compact: one tap „Bezahlt“ pays today, the whole sum', async () => {
    await add();
    render(
      <MemoryRouter>
        <PlanPanel id="inv1" compact />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Bezahlt' }));
    await waitFor(async () => expect((await invoiceRepo.get('inv1'))?.status).toBe('paid'));
    expect((await invoiceRepo.get('inv1'))?.paidAt).toBe('2026-11-09');
  });
});
