import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { addPayment, markOpen, markPaid, removePayment, saveInvoice } from '../actions';
import { formatIban, ibanValid, normalizeIban } from '../iban';
import {
  fullyCovered,
  invoiceState,
  openTotal,
  openTotalText,
  paidSum,
  paymentBlock,
  remainingMinor,
  sortInvoices,
} from '../logic';
import { listOpenInvoices, sumOpenInvoices } from '../public';
import { invoiceRepo } from '../repo';
import { invoiceSchema } from '../schema';

const inv = (over: Record<string, unknown> = {}) =>
  invoiceSchema.parse({ payee: 'Stadtwerke', amountMinor: 10000, dueDate: '2026-10-05', ...over });
const part = (id: string, amountMinor: number, date = '2026-10-01') => ({ id, amountMinor, date });

beforeEach(async () => {
  bus.clear();
  await db.table('invoices_invoice').clear();
  await db.table('_settings').clear();
});

describe('rest and state of an invoice (expectation table)', () => {
  const rows: [string, Record<string, unknown>, string, string, number, number][] = [
    // name, overrides, today, expected kind, rest, daysOverdue
    ['open, due in the future', {}, '2026-10-01', 'open', 10000, 0],
    ['open, due today is not overdue', {}, '2026-10-05', 'open', 10000, 0],
    ['open, due yesterday', {}, '2026-10-06', 'overdue', 10000, 1],
    ['open, 12 days late', {}, '2026-10-17', 'overdue', 10000, 12],
    ['partly paid, not due yet', { payments: [part('a', 4000)] }, '2026-10-01', 'partial', 6000, 0],
    ['partly paid and overdue', { payments: [part('a', 4000)] }, '2026-10-08', 'overdue', 6000, 3],
    [
      'two parts',
      { payments: [part('a', 3333), part('b', 3334)] },
      '2026-10-01',
      'partial',
      3333,
      0,
    ],
    ['paid', { status: 'paid', paidAt: '2026-10-02' }, '2026-12-01', 'paid', 0, 0],
    [
      'paid after parts',
      { status: 'paid', payments: [part('a', 4000)] },
      '2026-12-01',
      'paid',
      0,
      0,
    ],
  ];
  it.each(rows)('%s', (_n, over, day, kind, rest, late) => {
    const s = invoiceState(inv(over), day);
    expect(s.kind).toBe(kind);
    expect(s.restMinor).toBe(rest);
    expect(s.daysOverdue).toBe(late);
  });

  it('the partial flag also stays on an overdue partly paid invoice', () => {
    expect(invoiceState(inv({ payments: [part('a', 1)] }), '2026-11-01').partial).toBe(true);
    expect(invoiceState(inv(), '2026-11-01').partial).toBe(false);
  });

  it('the rest is never negative; covered means the parts reach the amount', () => {
    const over = inv({ payments: [part('a', 12000)] });
    expect(paidSum(over)).toBe(12000);
    expect(remainingMinor(over)).toBe(0);
    expect(fullyCovered(over)).toBe(true);
    expect(fullyCovered(inv({ payments: [part('a', 9999)] }))).toBe(false);
  });

  it('open totals count only the rest, per currency', () => {
    const list = [
      inv({ payments: [part('a', 2500)] }),
      inv({ amountMinor: 5000 }),
      inv({ status: 'paid' }),
      inv({ amountMinor: 700, currency: 'USD' }),
    ];
    expect(openTotal(list.filter((i) => i.currency === undefined))).toBe(7500 + 5000);
    expect(openTotalText(list)).toContain('125,00');
    expect(openTotalText(list)).toContain('7,00');
  });

  it('a higher reminder level sorts first on the same due date', () => {
    const c = (id: string, over: Record<string, unknown>) => ({ ...inv(over), id, createdAt: 1 });
    expect(
      sortInvoices([c('a', {}), c('b', { dunningLevel: 2 }), c('c', { dunningLevel: 1 })]).map(
        (i) => i.id,
      ),
    ).toEqual(['b', 'c', 'a']);
  });
});

describe('IBAN', () => {
  it.each([
    ['DE89 3704 0044 0532 0130 00', true],
    ['de89370400440532013000', true],
    ['GB82 WEST 1234 5698 7654 32', true],
    ['FR14 2004 1010 0505 0001 3M02 606', true],
    ['DE89 3704 0044 0532 0130 01', false], // checksum
    ['DE89 3704 0044 0532 013', false], // too short
    ['1234567890', false],
    ['', false],
  ])('%s → %s', (iban, ok) => expect(ibanValid(iban)).toBe(ok));

  it('normalises and groups in fours', () => {
    expect(normalizeIban(' de89-3704 0044 ')).toBe('DE8937040044');
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });
});

describe('payment block', () => {
  const labels = { recipient: 'To', iban: 'IBAN', bic: 'BIC', reference: 'Ref', amount: 'Amount' };
  it('lists what exists, IBAN grouped, in order', () => {
    expect(
      paymentBlock(
        { payee: 'Stadtwerke', iban: 'de89370400440532013000', bic: 'cobadeff', reference: 'R-1' },
        '60,00 €',
        labels,
      ),
    ).toBe(
      'To: Stadtwerke\nIBAN: DE89 3704 0044 0532 0130 00\nBIC: COBADEFF\nRef: R-1\nAmount: 60,00 €',
    );
  });
  it('leaves out what is missing', () => {
    expect(paymentBlock({ payee: 'X' }, '1,00 €', labels)).toBe('To: X\nAmount: 1,00 €');
  });
});

describe('part payments', () => {
  it('records a part, announces it and keeps the invoice open with the rest', async () => {
    const events: unknown[] = [];
    bus.on('invoice.payment', (p) => void events.push(p));
    const i = await invoiceRepo.create(inv());
    const payment = await addPayment(i.id, 4000, '2026-10-02');
    const after = (await invoiceRepo.get(i.id))!;
    expect(after.status).toBe('open');
    expect(remainingMinor(after)).toBe(6000);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      invoiceId: i.id,
      paymentId: payment!.id,
      amountMinor: 4000,
      date: '2026-10-02',
    });
    expect(await sumOpenInvoices()).toBe(6000);
    expect((await listOpenInvoices())[0]!.amountMinor).toBe(6000);
  });

  it('caps a payment at the rest; the payment that covers it pays the invoice with an empty rest', async () => {
    const paid: unknown[] = [];
    bus.on('invoice.paid', (p) => void paid.push(p));
    const i = await invoiceRepo.create(inv());
    await addPayment(i.id, 4000, '2026-10-02');
    const last = await addPayment(i.id, 99999, '2026-10-03');
    expect(last!.amountMinor).toBe(6000);
    const after = (await invoiceRepo.get(i.id))!;
    expect(after.status).toBe('paid');
    expect(after.paidAt).toBe('2026-10-03');
    expect(paid).toEqual([expect.objectContaining({ invoiceId: i.id, amountMinor: 0 })]);
  });

  it('paying the rest by hand announces only the rest', async () => {
    const paid: { amountMinor: number }[] = [];
    bus.on('invoice.paid', (p) => void paid.push(p));
    const i = await invoiceRepo.create(inv({ payments: [part('a', 2500)] }));
    await markPaid(i.id, '2026-10-04');
    expect(paid[0]!.amountMinor).toBe(7500);
  });

  it('ignores a payment on a paid invoice and an empty amount', async () => {
    const i = await invoiceRepo.create(inv({ status: 'paid', paidAt: '2026-10-01' }));
    expect(await addPayment(i.id, 100)).toBeUndefined();
    const open = await invoiceRepo.create(inv());
    expect(await addPayment(open.id, 0)).toBeUndefined();
  });

  it('removing a part announces it and reopens a paid invoice', async () => {
    const removed: unknown[] = [];
    const unpaid: unknown[] = [];
    bus.on('invoice.paymentRemoved', (p) => void removed.push(p));
    bus.on('invoice.unpaid', (p) => void unpaid.push(p));
    const i = await invoiceRepo.create(inv());
    const p1 = await addPayment(i.id, 4000, '2026-10-02');
    await addPayment(i.id, 6000, '2026-10-03');
    expect((await invoiceRepo.get(i.id))!.status).toBe('paid');
    await removePayment(i.id, p1!.id);
    const after = (await invoiceRepo.get(i.id))!;
    expect(after.status).toBe('open');
    expect(after.payments).toHaveLength(1);
    expect(removed).toEqual([{ invoiceId: i.id, paymentId: p1!.id }]);
    expect(unpaid).toHaveLength(1);
  });

  it('reopening keeps the part payments (they stay booked)', async () => {
    const i = await invoiceRepo.create(inv({ payments: [part('a', 2500)] }));
    await markPaid(i.id);
    await markOpen(i.id);
    expect((await invoiceRepo.get(i.id))!.payments).toHaveLength(1);
  });

  it('a repeating invoice brings the next one when the last part pays it; bank details carry on', async () => {
    const i = await invoiceRepo.create(inv({ repeat: 'monthly', iban: 'DE89370400440532013000' }));
    await addPayment(i.id, 10000, '2026-10-02');
    const all = await invoiceRepo.active().toArray();
    const next = all.find((x) => x.repeatOf === i.id)!;
    expect(next.dueDate).toBe('2026-11-05');
    expect(next.iban).toBe('DE89370400440532013000');
    expect(next.payments).toBeUndefined();
  });

  it('editing a paid invoice announces the rest after its part payments', async () => {
    const paid: { amountMinor: number }[] = [];
    bus.on('invoice.paid', (p) => void paid.push(p));
    const i = await invoiceRepo.create(
      inv({ status: 'paid', paidAt: '2026-10-02', payments: [part('a', 4000)] }),
    );
    await saveInvoice(i.id, {
      ...inv({ status: 'paid', paidAt: '2026-10-02', payments: [part('a', 4000)] }),
      amountMinor: 12000,
    });
    expect(paid.at(-1)!.amountMinor).toBe(8000);
  });
});
