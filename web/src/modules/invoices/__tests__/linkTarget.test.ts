import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import target from '../linkTarget';
import { invoiceRepo } from '../repo';

const base = { payee: 'Stadtwerke', amountMinor: 9240, dueDate: '2026-11-20' };

beforeEach(async () => {
  await db.table('invoices_invoice').clear();
});

describe('invoices as a link target', () => {
  it('alive: payee, route, and `done` only while paid', async () => {
    const open = await invoiceRepo.create({ ...base, status: 'open' });
    expect(await target.resolve(open.id)).toEqual({
      state: 'alive',
      title: 'Stadtwerke',
      to: `/invoices?open=${open.id}`,
      done: false,
    });
    const paid = await invoiceRepo.create({ ...base, status: 'paid', paidAt: '2026-11-10' });
    expect(await target.resolve(paid.id)).toMatchObject({ state: 'alive', done: true });
  });

  it('gone: a soft-deleted invoice and an id that was never here', async () => {
    const i = await invoiceRepo.create({ ...base, status: 'open' });
    await invoiceRepo.remove(i.id);
    expect(await target.resolve(i.id)).toEqual({ state: 'gone' });
    expect(await target.resolve('mail-0000')).toEqual({ state: 'gone' });
  });

  it('a malformed id is gone', async () => {
    expect(await target.resolve('1&do=pay')).toEqual({ state: 'gone' });
    expect(await target.resolve('')).toEqual({ state: 'gone' });
  });
});
