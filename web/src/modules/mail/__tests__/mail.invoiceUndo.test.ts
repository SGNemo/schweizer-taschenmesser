// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import type { MailAccountRef } from '@/core/mail/types';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { createInvoice, invoiceIds, invoiceOffers, type InvoiceThread } from '../invoiceRow';
import { mailDay } from '../links';

/**
 * Planner hub S1 follow-ups: one undo takes the invoice and its link row back each on its own, so a failing
 * entry undo never leaves the link behind; the mail's day for a link is its local calendar day. Invented data.
 */
const account: MailAccountRef = {
  key: 'google#a1',
  connectorId: 'google',
  email: 'me@example.org',
};
const bill = {
  id: 'thr-bill-1',
  from: { name: 'Stadtwerke Musterstadt', email: 'rechnung@stadtwerke.example.org' },
  date: new Date(2026, 9, 20, 9, 0).getTime(),
  labelIds: ['INBOX'],
  lastMessageId: 'msg-bill-1',
  subject: 'Ihre Rechnung für Oktober',
  snippet: 'Ihre Rechnung über 84,30 EUR ist fällig am 02.11.',
} as InvoiceThread;

const liveLinks = async () =>
  ((await db.table('_links').toArray()) as { deletedAt: number | null }[]).filter(
    (r) => r.deletedAt === null,
  );

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
  await clearAll();
  await db.table('_links').clear();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => setNow());

describe('the undo of „Anlegen“', () => {
  it('removes the link row even when taking the invoice back fails', async () => {
    const offer = (await invoiceOffers([bill], await invoiceIds([bill]))).get(bill.id)!;
    await createInvoice(account, bill, offer as never, () => {});
    expect(await liveLinks()).toHaveLength(1);
    const toast = useUiStore.getState().toasts.at(-1)!;

    // Every write to the invoice table fails from here on.
    const table = db.table('invoices_invoice');
    const fail = () => {
      throw new Error('invoice write refused');
    };
    table.hook('updating', fail);
    table.hook('creating', fail);
    try {
      toast.action!.run();
      await vi.waitFor(async () => expect(await liveLinks()).toHaveLength(0));
    } finally {
      table.hook('updating').unsubscribe(fail);
      table.hook('creating').unsubscribe(fail);
    }
  });
});

describe('mailDay', () => {
  it('is the local calendar day, also just after local midnight', () => {
    expect(mailDay(new Date(2026, 10, 3, 0, 30).getTime())).toBe('2026-11-03');
    expect(mailDay(new Date(2026, 10, 3, 23, 45).getTime())).toBe('2026-11-03');
  });

  it('is none for an unreadable date (the link then carries no day) and never throws', () => {
    expect(mailDay(Number.NaN)).toBeUndefined();
    expect(mailDay(new Date('not a date').getTime())).toBeUndefined();
  });
});
