// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from '@/core/ai/testing';
import { db, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { linkEntries, linksOf } from '@/core/entitylinks';
import type { MailAccountRef } from '@/core/mail/types';
import { getManifest } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { createTestDb } from '@/test-utils';
import { t } from '@/strings';
import {
  createInvoice,
  invoiceIds,
  invoiceOffers,
  noteReminder,
  type InvoiceOffer,
  type InvoiceThread,
} from '../invoiceRow';
import { loadLinks } from '../links';

/**
 * Planner hub S1, the dunning chain (docs/design/planner-hub/CONCEPT-LINKS.md §2 steps 1, 2, 5; §1.4): the tap
 * that files an invoice from a mail, and the tap that notes a reminder on it, each write one synced link row
 * invoice → mail thread. Invented data.
 */
const ADDRESS = 'me@example.org';
const ACCOUNT_KEY = 'google#a1';
const account: MailAccountRef = { key: ACCOUNT_KEY, connectorId: 'google', email: ADDRESS };
const at = (d: string) => new Date(`${d}T09:00:00Z`).getTime();
const mail = (over: Partial<InvoiceThread> & { snippet: string; subject: string }) =>
  ({
    id: 'thr-bill-1',
    from: { name: 'Stadtwerke Musterstadt', email: 'rechnung@stadtwerke.example.org' },
    date: at('2026-10-20'),
    labelIds: ['INBOX'],
    lastMessageId: 'msg-bill-1',
    ...over,
  }) as InvoiceThread;
const bill = mail({
  subject: 'AW: Re: Ihre Rechnung für Oktober',
  snippet: 'Ihre Rechnung über 84,30 EUR ist fällig am 02.11.',
});
const reminder = mail({
  id: 'thr-dun-2',
  lastMessageId: 'msg-dun-2',
  date: at('2026-11-03'),
  subject: 'Zahlungserinnerung',
  snippet: 'Bitte zahlen Sie 92,40 EUR bis 20.11. inkl. Mahngebühr.',
});

const LINKS = '_links';
const rows = async (database: TaschenmesserDB = db) =>
  (await database.table(LINKS).toArray()) as Record<string, unknown>[];
const liveRows = async () => (await rows()).filter((r) => r.deletedAt === null);
const invoices = async () =>
  ((await db.table('invoices_invoice').toArray()) as Record<string, unknown>[]).filter(
    (r) => r.deletedAt === null,
  );
const lastToast = () => useUiStore.getState().toasts.at(-1);
const offerOf = async (th: InvoiceThread) =>
  (await invoiceOffers([th], await invoiceIds([th]))).get(th.id)!;

async function file(): Promise<string> {
  const offer = await offerOf(bill);
  await createInvoice(account, bill, offer as Extract<InvoiceOffer, { kind: 'create' }>, () => {});
  return String((await invoices())[0]!.id);
}
async function note(): Promise<void> {
  const offer = await offerOf(reminder);
  expect(offer.kind).toBe('note');
  await noteReminder(account, reminder, offer as Extract<InvoiceOffer, { kind: 'note' }>, () => {});
}

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 5, 10, 0).getTime());
  await clearAll();
  await db.table(LINKS).clear();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => setNow());

describe('step 1: „Anlegen“ writes the link invoice → mail', () => {
  it('one row: origin, the cleaned subject as label, the mail’s day; no mail URL in the note (P56)', async () => {
    const id = await file();
    const [row, ...more] = await liveRows();
    expect(more).toEqual([]);
    expect(row).toMatchObject({
      from: { module: 'invoices', id },
      to: { module: 'mail', id: 'thr-bill-1' },
      rel: 'origin',
      label: 'Ihre Rechnung für Oktober',
      on: '2026-10-20',
    });
    const [invoice] = await invoices();
    expect(invoice!.note).toBeUndefined();
    expect(JSON.stringify(invoice)).not.toContain('mail.google.com');
  });

  it('a second tap writes nothing; the undo takes the invoice and the link back; again brings both back', async () => {
    const id = await file();
    const toast = lastToast()!;
    await file();
    expect(lastToast()?.message).toBe(t.mail.invoice.already);
    expect(await liveRows()).toHaveLength(1);

    toast.action!.run();
    await vi.waitFor(async () => expect(await invoices()).toHaveLength(0));
    await vi.waitFor(async () => expect(await liveRows()).toHaveLength(0));

    expect(await file()).toBe(id);
    expect(await liveRows()).toHaveLength(1);
    expect(await rows()).toHaveLength(1); // the same row, restored
  });

  it('a subject is capped at 120 characters; none reads as the app’s own text', async () => {
    const long = mail({ ...bill, subject: `Rechnung ${'x'.repeat(200)}` });
    const offer = await offerOf(long);
    await createInvoice(account, long, offer as never, () => {});
    expect(String((await liveRows())[0]!.label)).toHaveLength(120);
  });
});

describe('step 2: „Mahnung vermerken“ – one tap', () => {
  it('writes the dunned fields and the dunning link with the reminder mail’s day; one undo takes both back', async () => {
    const id = await file();
    await note();
    const [invoice] = await invoices();
    expect(invoice).toMatchObject({
      amountMinor: 8430, // the invoice's own amount and due date stay
      dueDate: '2026-11-02',
      dunningLevel: 1,
      dunnedAt: '2026-11-03',
      dunnedDueDate: '2026-11-20',
      dunnedAmountMinor: 9240,
    });
    const links = await linkEntries({ module: 'invoices', id });
    expect(links.map((l) => [l.link.rel, l.link.to.id, l.link.on, l.link.label])).toEqual([
      ['origin', 'thr-bill-1', '2026-10-20', 'Ihre Rechnung für Oktober'],
      ['dunning', 'thr-dun-2', '2026-11-03', 'Zahlungserinnerung'],
    ]);
    const noted = lastToast()!;
    expect(noted.message).toBe(t.mail.invoice.noted);

    // Noting the same reminder twice writes nothing – neither the fields nor a link.
    const before = JSON.stringify([await invoices(), await rows()]);
    const again = await offerOf(reminder);
    expect(again).toMatchObject({ kind: 'note', noted: true });
    await noteReminder(account, reminder, again as never, () => {});
    expect(lastToast()?.message).toBe(t.mail.invoice.alreadyNoted);
    expect(JSON.stringify([await invoices(), await rows()])).toBe(before);

    noted.action!.run();
    await vi.waitFor(async () => expect((await invoices())[0]!.dunnedDueDate).toBeUndefined());
    await vi.waitFor(async () => expect(await liveRows()).toHaveLength(1));
    const [back] = await invoices();
    expect(back).toMatchObject({ amountMinor: 8430, dueDate: '2026-11-02' });
    expect(back!.dunningLevel).toBeUndefined();
    expect(back!.dunnedAmountMinor).toBeUndefined();
    expect((await liveRows())[0]!.rel).toBe('origin');
  });
});

describe('privacy (§1.4): what a link row of these paths holds', () => {
  it('thread id, subject label, the mail’s day – never an address, the account key or a message id', async () => {
    await file();
    await note();
    const stored = await rows();
    expect(stored).toHaveLength(2);
    for (const row of stored) {
      // Exactly these fields: the envelope and the link; nothing a path could smuggle in.
      expect(Object.keys(row).sort()).toEqual(
        [
          '_f',
          'createdAt',
          'deletedAt',
          'deviceId',
          'from',
          'fromKey',
          'id',
          'label',
          'on',
          'rel',
          'to',
          'toKey',
          'updatedAt',
        ].sort(),
      );
      const text = JSON.stringify(row);
      for (const secret of [
        ADDRESS,
        'stadtwerke.example.org',
        '@',
        ACCOUNT_KEY,
        'google',
        'msg-bill-1',
        'msg-dun-2',
        'authuser',
        'http',
        'Mahngebühr', // text of the mail
        '84,30',
      ])
        expect(text).not.toContain(secret);
      // The id travels in clear: a hash, no ref in it.
      expect(String(row.id)).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('step 5: „Aus dieser Mail angelegt“ (P44, P45)', () => {
  it('lists the invoice once (local row ∪ link row) and opens the entry, not the module page', async () => {
    const id = await file();
    await note();
    for (const thread of ['thr-bill-1', 'thr-dun-2']) {
      const list = await loadLinks(ACCOUNT_KEY, thread);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        type: 'invoice',
        title: 'Stadtwerke Musterstadt',
        to: `/invoices?open=${id}`,
        dead: false,
      });
    }
  });

  it('a desktop that never filed the mail (no local row) shows the same entry from the synced link', async () => {
    const id = await file();
    await db.table('mail_link').clear();
    const list = await loadLinks('google#other-device', 'thr-bill-1');
    expect(list).toEqual([
      {
        id: `invoices:${id}`,
        type: 'invoice',
        moduleId: 'invoices',
        title: 'Stadtwerke Musterstadt',
        to: `/invoices?open=${id}`,
        dead: false,
      },
    ]);
    // An id that is no plain provider id reads nothing.
    expect(await loadLinks('google#other-device', 'thr bill/../1')).toEqual([]);
  });
});

describe('second device: the chain is synced data', () => {
  let other: TaschenmesserDB;
  afterEach(async () => {
    other.close();
    await other.delete();
  });

  it('the invoice, both link rows and the dunned fields reach a device that never saw the mails', async () => {
    const id = await file();
    await note();
    const server = new MemoryServer();
    other = createTestDb();
    await runSync({ storage: new DexieStorageAdapter(db), adapter: server.adapter() });
    await runSync({ storage: new DexieStorageAdapter(other), adapter: server.adapter() });

    const invoice = await createCollectionRepo(getManifest('invoices')!, 'invoice', other).get(id);
    expect(invoice).toMatchObject({
      payee: 'Stadtwerke Musterstadt',
      amountMinor: 8430,
      dueDate: '2026-11-02',
      dunningLevel: 1,
      dunnedAt: '2026-11-03',
      dunnedDueDate: '2026-11-20',
      dunnedAmountMinor: 9240,
    });
    const links = await linkEntries({ module: 'invoices', id }, other);
    expect(links.map((l) => [l.link.rel, l.link.to.id, l.link.on])).toEqual([
      ['origin', 'thr-bill-1', '2026-10-20'],
      ['dunning', 'thr-dun-2', '2026-11-03'],
    ]);
    // The reverse read (the thread's „Angelegt“) works there too.
    expect(await linkEntries({ module: 'mail', id: 'thr-dun-2' }, other)).toHaveLength(1);
    // The device-local half stays where it was written.
    expect(await other.table('mail_link').count()).toBe(0);
    expect(await db.table('mail_link').count()).toBeGreaterThan(0);
  });

  it('where the thread cannot be read the link offers the web address, no account in it', async () => {
    const id = await file();
    const [link] = await linksOf({ module: 'invoices', id });
    // `elsewhere` on a desktop without the thread, `unavailable` where the mail module is off or missing.
    expect(['elsewhere', 'unavailable']).toContain(link!.state.state);
    const url = 'url' in link!.state ? link!.state.url : undefined;
    expect(url).toContain('thr-bill-1');
    expect(url).not.toMatch(/authuser|@|google#/);
  });
});
