// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { readInvoiceMail } from '@/core/mail/heuristics';
import type { MailAccountRef } from '@/core/mail/types';
import { formatMoney } from '@/core/money';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { captureId } from '@/quickCapture/targets';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import {
  createInvoice,
  invoiceIds,
  invoiceMailId,
  invoiceOffers,
  noteReminder,
  offerText,
  toCreate,
  type InvoiceOffer,
  type InvoiceThread,
} from '../invoiceRow';

// „Kopf leer“ 3b: invoices and payment reminders from the mail list. Invented data.
const account: MailAccountRef = {
  key: 'google#a1',
  connectorId: 'google',
  email: 'me@example.org',
};
const at = (d: string) => new Date(`${d}T09:00:00`).getTime();
const mail = (over: Partial<InvoiceThread> & { snippet: string; subject: string }) =>
  ({
    id: 't-1',
    from: { name: 'Stadtwerke Musterstadt', email: 'rechnung@stadtwerke.example.org' },
    date: at('2026-09-28'),
    labelIds: ['INBOX'],
    lastMessageId: 'm-1',
    ...over,
  }) as InvoiceThread;
const bill = mail({
  subject: 'Ihre Rechnung für Oktober',
  snippet: 'Ihre Rechnung über 84,30 EUR ist fällig am 15.10.',
});
const reminder = mail({
  id: 't-2',
  lastMessageId: 'm-2',
  subject: 'Zahlungserinnerung',
  snippet: 'Bitte zahlen Sie 92,40 EUR bis 13.10. inkl. Mahngebühr.',
});

const invoices = () => createCollectionRepo(getManifest('invoices')!, 'invoice');
const live = async () => (await db.table('invoices_invoice').toArray()).filter((r) => !r.deletedAt);
const lastToast = () => useUiStore.getState().toasts.at(-1);
const offersOf = async (threads: InvoiceThread[]) =>
  invoiceOffers(threads, await invoiceIds(threads));
const offerOf = async (th: InvoiceThread) => (await offersOf([th])).get(th.id)!;

beforeEach(async () => {
  setNow(() => new Date(2026, 8, 30, 10, 0).getTime());
  await clearAll();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => setNow());

describe('reading a row', () => {
  const read = (
    subject: string,
    snippet: string,
    from = 'Stadtwerke Musterstadt <x@example.org>',
  ) => readInvoiceMail({ id: 'm', from, subject, snippet, dateMs: at('2026-09-28'), bulk: false });

  it('one amount, a due day and a name: sure', () => {
    expect(read('Ihre Rechnung', 'Rechnung über 84,30 EUR, fällig am 15.10.')).toMatchObject({
      payee: 'Stadtwerke Musterstadt',
      amountMinor: 8430,
      date: '2026-10-15',
      debit: false,
      sure: true,
    });
  });

  it('two amounts, no date or an address as the payee: not sure (the sheet asks)', () => {
    expect(read('Rechnung', 'Rechnung 84,30 EUR, Vormonat 12,00 EUR, fällig am 15.10.')?.sure).toBe(
      false,
    );
    expect(read('Rechnung', 'Ihre Rechnung über 84,30 EUR.')?.sure).toBe(false);
    expect(
      read('Rechnung', 'Rechnung über 84,30 EUR, fällig am 15.10.', 'x@example.org')?.sure,
    ).toBe(false);
  });

  it('„wird abgebucht“ is a debit with its day; a reminder carries its level and deadline', () => {
    expect(
      read('Rechnung 2026-1042', 'Über 39,99 EUR. Der Betrag wird am 03.10. abgebucht.'),
    ).toMatchObject({ debit: true, date: '2026-10-03' });
    expect(read('2. Mahnung', 'Bitte zahlen Sie 92,40 EUR bis 13.10.')).toMatchObject({
      dunning: 2,
      date: '2026-10-13',
      debit: false,
      sure: true,
    });
  });

  it('the id comes from the message id alone: inputs exactly [messageId, "invoice"]', async () => {
    const id = await invoiceMailId('m-1');
    expect(id).toBe(`mail-${await captureId(['m-1', 'invoice'])}`);
    expect(id).not.toMatch(/@|google/);
  });
});

describe('„Anlegen“', () => {
  it('writes exactly the values the row shows; a second tap finds it; no address stored', async () => {
    const offer = await offerOf(bill);
    expect(offer.kind).toBe('create');
    expect(offerText(offer, '2026-09-30').text).toContain('Stadtwerke Musterstadt · 84,30');
    await createInvoice(
      account,
      bill,
      offer as Extract<InvoiceOffer, { kind: 'create' }>,
      () => {},
    );
    const [inv] = await live();
    expect(inv).toMatchObject({
      payee: 'Stadtwerke Musterstadt',
      amountMinor: 8430,
      dueDate: '2026-10-15',
      status: 'open',
    });
    expect(JSON.stringify(inv)).not.toMatch(/@|authuser|google#/);
    expect(lastToast()?.message).toBe(t.mail.invoice.created);
    const again = await offerOf(bill);
    expect(again).toMatchObject({ kind: 'create', state: 'live' });
    await createInvoice(
      account,
      bill,
      again as Extract<InvoiceOffer, { kind: 'create' }>,
      () => {},
    );
    expect(await live()).toHaveLength(1);
    expect(lastToast()?.message).toBe(t.mail.invoice.already);
    expect(lastToast()?.action).toBeUndefined();
  });

  it('undo takes it back; „Anlegen“ again brings back the same invoice', async () => {
    await createInvoice(account, bill, (await offerOf(bill)) as never, () => {});
    const id = (await live())[0]!.id;
    lastToast()!.action!.run();
    await vi.waitFor(async () => expect(await live()).toHaveLength(0));
    expect(await offerOf(bill)).toMatchObject({ state: 'deleted' });
    await createInvoice(account, bill, (await offerOf(bill)) as never, () => {});
    expect((await live()).map((r) => r.id)).toEqual([id]);
  });

  it('after the due day the line says „Frist war …“ (no verb change, no red)', async () => {
    const offer = await offerOf(bill);
    const { late } = offerText(offer, '2026-10-20');
    expect(late).toBe(t.mail.invoice.late('15. Okt.'));
  });

  it('a debit offers no verb and counts as nothing to add', async () => {
    const debit = mail({
      id: 't-3',
      lastMessageId: 'm-3',
      subject: 'Rechnung 2026-1042',
      snippet: 'Anbei Ihre Rechnung über 39,99 EUR. Der Betrag wird am 03.10. abgebucht.',
    });
    const offers = await offersOf([debit, bill]);
    expect(offers.get('t-3')?.kind).toBe('debit');
    expect(offerText(offers.get('t-3')!, '2026-09-30').text).toContain(
      t.mail.invoice.debit('3. Okt.'),
    );
    expect(toCreate(offers)).toBe(1);
  });
});

describe('„Mahnung vermerken“', () => {
  async function openInvoice(id: string, payee: string, amountMinor: number, dueDate: string) {
    await invoices().createMany([
      { id, data: { payee, amountMinor, dueDate, status: 'open', note: 'Kundennummer 4711' } },
    ]);
  }

  it('notes level, day and one line on the open invoice; amount and due stay; idempotent; undo', async () => {
    await openInvoice('inv-1', 'Stadtwerke Musterstadt', 8740, '2026-09-17');
    const offer = await offerOf(reminder);
    expect(offer).toMatchObject({ kind: 'note', noted: false, match: { id: 'inv-1' } });
    expect(offerText(offer, '2026-09-30').text).toContain(
      t.mail.invoice.reminderFor('Stadtwerke Musterstadt', '17. Sep.', formatMoney(8740)),
    );
    await noteReminder(account, reminder, offer as never, () => {});
    const row = (await invoices().get('inv-1')) as Record<string, unknown>;
    expect(row).toMatchObject({
      amountMinor: 8740,
      dueDate: '2026-09-17',
      dunningLevel: 1,
      dunnedAt: '2026-09-28',
    });
    expect(String(row.note)).toMatch(
      /^Kundennummer 4711\nMahnung vom 28\.09\.2026: 92,40\s€ bis 13\.10\.2026$/,
    );
    expect(lastToast()?.message).toBe(t.mail.invoice.noted);
    expect(await offerOf(reminder)).toMatchObject({ kind: 'note', noted: true });
    // Undo restores exactly what it wrote and never deletes the invoice.
    lastToast()!.action!.run();
    await vi.waitFor(async () =>
      expect(await invoices().get('inv-1')).toMatchObject({ note: 'Kundennummer 4711' }),
    );
    const back = (await invoices().get('inv-1')) as Record<string, unknown>;
    expect(back.dunningLevel).toBeUndefined();
    expect(back.deletedAt).toBeNull();
  });

  it('no open invoice: a new one at its level; two equally good ones: the sheet asks', async () => {
    const offer = await offerOf(reminder);
    expect(offer.kind).toBe('create');
    await createInvoice(account, reminder, offer as never, () => {});
    expect((await live())[0]).toMatchObject({
      amountMinor: 9240,
      dunningLevel: 1,
      dunnedAt: '2026-09-28',
    });
    await clearAll();
    await openInvoice('a', 'Stadtwerke Musterstadt', 8740, '2026-09-17');
    await openInvoice('b', 'Stadtwerke Musterstadt', 8740, '2026-09-17');
    expect((await offerOf(reminder)).kind).toBe('check');
  });
});

describe('council round 1', () => {
  it('a reminder that made its own invoice stays „angelegt“, never „vermerkt“ on itself', async () => {
    await createInvoice(account, reminder, (await offerOf(reminder)) as never, () => {});
    const offer = await offerOf(reminder);
    expect(offer).toMatchObject({ kind: 'create', state: 'live' });
    // Its line said what the tap writes: a reminder level.
    expect(offerText({ ...offer, state: undefined } as InvoiceOffer, '2026-09-30').text).toMatch(
      /^Mahnung · Stadtwerke Musterstadt/,
    );
  });

  it('an invoice filed from the message through the sheet counts as done; deleted and unsure ones are not counted', async () => {
    await invoices().createMany([
      {
        id: 'by-hand',
        data: {
          payee: 'Stadtwerke Musterstadt',
          amountMinor: 8430,
          dueDate: '2026-10-15',
          status: 'open',
        },
      },
    ]);
    await db.table('mail_link').add({
      id: 'l1',
      accountKey: account.key,
      threadId: 't-1',
      messageId: 'm-1',
      type: 'invoice',
      moduleId: 'invoices',
      collection: 'invoice',
      entryId: 'by-hand',
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'd',
      deletedAt: null,
      _f: {},
    });
    const unsure = mail({
      id: 't-4',
      lastMessageId: 'm-4',
      subject: 'Rechnung',
      snippet: 'Ihre Rechnung über 12,00 EUR.',
    });
    const offers = await offersOf([bill, unsure]);
    expect(offers.get('t-1')).toMatchObject({ kind: 'create', state: 'live' });
    expect(offers.get('t-4')?.kind).toBe('check');
    expect(toCreate(offers)).toBe(0);
  });

  it('a thread the person wrote in shows no line; a fee clause is no reminder', async () => {
    expect((await offersOf([{ ...bill, labelIds: ['INBOX', 'SENT'] }])).size).toBe(0);
    expect((await offersOf([{ ...bill, labelIds: ['INBOX', 'DRAFT'] }])).size).toBe(0);
    const fee = mail({
      id: 't-5',
      lastMessageId: 'm-5',
      subject: 'Ihre Rechnung',
      snippet: 'Rechnung über 84,30 EUR, fällig am 15.10. Mahnungsgebühren laut AGB.',
    });
    expect(await offerOf(fee)).toMatchObject({ kind: 'create' });
    expect((await offerOf(fee)).read.dunning).toBeUndefined();
  });
});

describe('council round 3', () => {
  const link = (id: string, messageId: string, entryId: string) =>
    db.table('mail_link').add({
      id,
      accountKey: account.key,
      threadId: 't-1',
      messageId,
      type: 'invoice',
      moduleId: 'invoices',
      collection: 'invoice',
      entryId,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'd',
      deletedAt: null,
      _f: {},
    });

  it('a sheet-filed invoice from an older message of the thread counts only with the same amount and due day', async () => {
    await invoices().createMany([
      {
        id: 'same',
        data: {
          payee: 'Stadtwerke Musterstadt',
          amountMinor: 8430,
          dueDate: '2026-10-15',
          status: 'open',
        },
      },
      {
        id: 'last-month',
        data: {
          payee: 'Stadtwerke Musterstadt',
          amountMinor: 7900,
          dueDate: '2026-09-15',
          status: 'open',
        },
      },
    ]);
    await link('l-old', 'm-0', 'last-month');
    // Last month's invoice in the same thread: this month's is still offered.
    const offer = await offerOf(bill);
    expect(offer.kind).toBe('create');
    expect((offer as { state?: string }).state).toBeUndefined();
    await link('l-same', 'm-0b', 'same');
    expect(await offerOf(bill)).toMatchObject({ kind: 'create', state: 'live' });
  });
});
