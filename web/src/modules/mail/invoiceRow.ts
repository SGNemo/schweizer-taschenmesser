/**
 * Invoices and payment reminders from the mail list („Kopf leer“ 3b, decisions/features.md 2026-11-08):
 * a row the heuristics read as an invoice with one amount and a date shows those values and one verb;
 * one tap writes the invoice through the quick-capture `invoice` target – the named exception to the
 * preview rule: the values are visible in the row before the tap and the toast carries the undo. A
 * payment reminder first looks for the open invoice (`findOpenInvoice` of package 2) and, when one fits,
 * notes the reminder on it (`amendCapture`: level, day, one note line – never amount or due date, never
 * a delete). Anything unsure opens today's preview sheet instead. Everything is read from the local
 * cache (sender, subject, preview line); nothing leaves the device for it.
 *
 * The invoice id comes from the provider's **message** id alone (a reminder usually answers in the same
 * thread), never an address or the device-local account key: tapping twice, or the same mail on another
 * device once the first has synced, finds the first invoice instead of doubling it. An invoice filed
 * through the sheet (random id) is known only on the device that filed it (its link row is device-local).
 */
import { createCollectionRepo } from '@/core/db/repo';
import { formatMoney } from '@/core/money';
import { readInvoiceMail, type InvoiceRead } from '@/core/mail/heuristics';
import { mailWebUrl } from '@/core/mail/service';
import type { MailAccountRef, MailAddress } from '@/core/mail/types';
import { getManifest } from '@/core/modules/registry';
import { formatDay } from '@/core/time/dates';
import { today } from '@/core/time/now';
import {
  amendCapture,
  captureId,
  CaptureError,
  reinstateCapture,
  saveCapture,
  type OpenInvoice,
  type SavedCapture,
} from '@/quickCapture/targets';
import { t } from '@/strings';
import { findOpenInvoice } from '@/quickCapture/targets/lookup';
import { useUiStore } from '@/stores/ui';
import { DEMO_ACCOUNT } from './cache';
import { saveLink } from './links';
import { linkRepo } from './repo';

/** What a list row knows: enough to read an invoice and to key it on the message. */
export interface InvoiceThread {
  id: string;
  from: MailAddress;
  subject: string;
  snippet: string;
  date: number;
  personal?: boolean;
  labelIds: string[];
  lastMessageId?: string;
}

/** The invoice's id: from the provider's message id alone (inputs exactly `[messageId, 'invoice']`). */
export const invoiceMailId = async (messageId: string): Promise<string> =>
  `mail-${await captureId([messageId, 'invoice'])}`;

/** The row's reading of a mail, or nothing (not an invoice, or no message id to key it on yet). */
export function readRow(th: InvoiceThread): InvoiceRead | undefined {
  if (!th.lastMessageId) return undefined;
  // A thread the person wrote in (a reply „überwiesen“, a forward): the newest sender may be them, so the
  // payee would be wrong. No line – the mail can still be filed through „Aus dieser Mail anlegen“.
  if (th.labelIds.includes('SENT') || th.labelIds.includes('DRAFT')) return undefined;
  const name = th.from.name?.trim();
  return readInvoiceMail({
    id: th.lastMessageId,
    from: name ? `${name} <${th.from.email}>` : th.from.email,
    subject: th.subject,
    snippet: th.snippet,
    dateMs: th.date,
    // „Not personal“ includes Gmail's update category, where invoices live: never read as a newsletter here.
    // The guard is `sure` (one amount, a date, a name) – anything less only opens the sheet.
    bulk: false,
  });
}

/** What the row offers. */
export type InvoiceOffer =
  /** „wird abgebucht“: the values as text, no verb. */
  | { kind: 'debit'; read: InvoiceRead }
  /** One tap writes a new invoice (also a reminder whose invoice was never filed: at its level). */
  | { kind: 'create'; read: InvoiceRead; id: string; state?: 'live' | 'deleted' }
  /** A reminder on an open invoice: one tap notes it there. */
  | { kind: 'note'; read: InvoiceRead; match: OpenInvoice; noted: boolean }
  /** Something is missing or unsure: the tap opens the preview sheet. */
  | { kind: 'check'; read: InvoiceRead };

const invoicesRepo = () => {
  const m = getManifest('invoices');
  return m ? createCollectionRepo(m, 'invoice') : undefined;
};

/** The invoice ids of the rows that read as an invoice (hashing is not a Dexie call: done before a live query). */
export async function invoiceIds(threads: readonly InvoiceThread[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const th of threads) if (readRow(th)) out.set(th.id, await invoiceMailId(th.lastMessageId!));
  return out;
}

/**
 * The offers for the listed rows: Dexie reads only (safe in a live query) – the invoices by the ids from
 * `invoiceIds`, and for reminders the open invoice they belong to. Rows that are no invoice are absent.
 */
export async function invoiceOffers(
  threads: readonly InvoiceThread[],
  ids: ReadonlyMap<string, string>,
): Promise<Map<string, InvoiceOffer>> {
  const out = new Map<string, InvoiceOffer>();
  const repo = invoicesRepo();
  if (!repo) return out;
  const reads = threads
    .map((th) => ({ th, read: readRow(th), id: ids.get(th.id) }))
    .filter((x): x is { th: InvoiceThread; read: InvoiceRead; id: string } => !!x.read && !!x.id);
  // The row's own invoice first (also a reminder's: it must not read as „vermerkt“ on itself), then an
  // invoice filed from this message through the sheet (its link row): both mean done, never a second one.
  const own = await repo.table.bulkGet(reads.map((x) => x.id));
  const filed = await filedMessages(reads);
  for (const [i, { th, read, id }] of reads.entries()) {
    if (read.debit) {
      out.set(th.id, { kind: 'debit', read });
      continue;
    }
    const mine = own[i];
    if (mine) {
      out.set(th.id, {
        kind: 'create',
        read,
        id,
        state: mine.deletedAt === null ? 'live' : 'deleted',
      });
      continue;
    }
    if (read.dunning && read.sure) {
      const found = await findOpenInvoice(reminderFields(read), { today: today() });
      if (found && 'match' in found) {
        const row = (await repo.get(found.match.id)) as { dunnedAt?: string } | undefined;
        const noted = !!row?.dunnedAt && row.dunnedAt >= read.mailDate;
        out.set(th.id, { kind: 'note', read, match: found.match, noted });
        continue;
      }
      // Several fit, or the payee is known and the amount does not: the sheet asks, never a guess.
      if (found) {
        out.set(
          th.id,
          filed.has(th.lastMessageId!)
            ? { kind: 'create', read, id, state: 'live' }
            : { kind: 'check', read },
        );
        continue;
      }
    }
    if (filed.has(th.lastMessageId!)) out.set(th.id, { kind: 'create', read, id, state: 'live' });
    else out.set(th.id, read.sure ? { kind: 'create', read, id } : { kind: 'check', read });
  }
  return out;
}

/** Messages an invoice was filed from (a live invoice behind its link row, e.g. saved through the sheet). */
async function filedMessages(
  rows: readonly { th: InvoiceThread; read: InvoiceRead }[],
): Promise<Set<string>> {
  // The newest message; for an invoice (not a reminder) also any other message of its thread, since the
  // sheet links the message that was open.
  const byMessage = new Set(rows.map((x) => x.th.lastMessageId!));
  const byThread = new Set(rows.filter((x) => !x.read.dunning).map((x) => x.th.id));
  const links = await linkRepo
    .active()
    .filter((r) => r.type === 'invoice' && (byMessage.has(r.messageId) || byThread.has(r.threadId)))
    .toArray();
  const repo = invoicesRepo();
  if (!repo || links.length === 0) return new Set();
  const found = await repo.table.bulkGet(links.map((l) => l.entryId));
  const live = links.filter((_, i) => found[i] && found[i]!.deletedAt === null);
  return new Set(
    rows
      .filter(
        (x) =>
          live.some((l) => l.messageId === x.th.lastMessageId) ||
          (!x.read.dunning && live.some((l) => l.threadId === x.th.id)),
      )
      .map((x) => x.th.lastMessageId!),
  );
}

/** The capture fields of a reminder: payee, new amount and deadline, level and the mail's day. */
function reminderFields(read: InvoiceRead) {
  return {
    title: read.payee,
    amountMinor: read.amountMinor,
    date: read.date,
    dunning: { level: read.dunning ?? 1, date: read.mailDate },
  };
}

const day = (d: string) => formatDay(d, 'd. MMM');

/** The muted line under the row: every value that will be written, before the tap. */
export function offerText(offer: InvoiceOffer, todayStr: string): { text: string; late?: string } {
  const { read } = offer;
  const money = read.amountMinor !== undefined ? formatMoney(read.amountMinor) : undefined;
  if (offer.kind === 'debit')
    return {
      text: [
        read.payee,
        money,
        read.date ? t.mail.invoice.debit(day(read.date)) : t.mail.invoice.debitNoDay,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  if (offer.kind === 'note') {
    const m = offer.match;
    return {
      text: [
        t.mail.invoice.reminderFor(m.payee, day(m.dueDate), formatMoney(m.restMinor)),
        money && read.date ? t.mail.invoice.reminderNew(money, day(read.date)) : money,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  }
  // A reminder that makes a new invoice says so: the tap also writes its level („Mahnung“).
  const head = [
    read.dunning ? t.mail.invoice.reminderWord(read.dunning) : undefined,
    read.payee,
    money,
  ]
    .filter(Boolean)
    .join(' · ');
  if (offer.kind === 'check' || !read.date) return { text: head };
  // After the due day the line says so in a warning tone (never red: nothing is overdue in mail).
  if (read.date < todayStr) return { text: head, late: t.mail.invoice.late(day(read.date)) };
  return { text: `${head} · ${t.mail.invoice.due(day(read.date))}` };
}

const toast = (...a: Parameters<ReturnType<typeof useUiStore.getState>['toast']>) =>
  useUiStore.getState().toast(...a);

/**
 * Writes this device's link row once (the thread view lists what came out of the mail). Never fatal: the
 * entry is written by then, so a failed link must not turn the toast into „nothing saved“.
 */
async function linkOnce(
  account: MailAccountRef,
  th: InvoiceThread,
  saved: SavedCapture,
): Promise<string | undefined> {
  try {
    const has = await linkRepo
      .active()
      .filter((r) => r.accountKey === account.key && r.threadId === th.id && r.entryId === saved.id)
      .first();
    return has ? undefined : await saveLink(account.key, th.id, th.lastMessageId!, saved);
  } catch {
    return undefined;
  }
}

/**
 * „Anlegen“: the invoice with exactly the values the row shows, the address-free web link as its note,
 * and for a reminder that has no open invoice its level. Already there → „Schon angelegt“, no undo;
 * deleted before → brought back (the same entry, not a second one).
 */
export async function createInvoice(
  account: MailAccountRef,
  th: InvoiceThread,
  offer: Extract<InvoiceOffer, { kind: 'create' }>,
  onChanged: () => void,
): Promise<void> {
  const { read } = offer;
  const note =
    account.key === DEMO_ACCOUNT ? undefined : mailWebUrl(account, th.id, { forStorage: true });
  try {
    let saved = await saveCapture(
      'invoice',
      {
        title: read.payee,
        amountMinor: read.amountMinor,
        date: read.date,
        ...(read.dunning ? { dunning: { level: read.dunning, date: read.mailDate } } : {}),
        ...(note ? { note } : {}),
      },
      { id: offer.id },
    );
    if (saved.existed === true) {
      await linkOnce(account, th, saved);
      onChanged();
      return void toast(t.mail.invoice.already);
    }
    if (saved.existed === 'tombstone') saved = await reinstateCapture('invoice', offer.id);
    const link = await linkOnce(account, th, saved);
    onChanged();
    const done = saved;
    toast(t.mail.invoice.created, {
      label: t.mail.write.undo,
      run: () =>
        void (async () => {
          await done.undo();
          if (link) await linkRepo.remove(link);
          onChanged();
          toast(t.mail.write.undone);
        })(),
    });
  } catch {
    toast(t.mail.invoice.failed);
  }
}

/**
 * „Mahnung vermerken“: on the open invoice the row names, three things – level + 1 (at most 3), the
 * mail's day, one note line; amount and due date stay. Noted already → „Schon vermerkt“. Settled or
 * gone since the list was read → said, nothing written.
 */
export async function noteReminder(
  account: MailAccountRef,
  th: InvoiceThread,
  offer: Extract<InvoiceOffer, { kind: 'note' }>,
  onChanged: () => void,
): Promise<void> {
  try {
    const saved = await amendCapture('invoice', reminderFields(offer.read), offer.match);
    if (saved.existed) return void toast(t.mail.invoice.alreadyNoted);
    const link = await linkOnce(account, th, saved);
    onChanged();
    toast(t.mail.invoice.noted, {
      label: t.mail.write.undo,
      run: () =>
        void (async () => {
          await saved.undo();
          if (link) await linkRepo.remove(link);
          onChanged();
          toast(t.mail.write.undone);
        })(),
    });
  } catch (e) {
    onChanged();
    toast(
      e instanceof CaptureError && e.code === 'stale'
        ? t.mail.invoice.stale
        : t.mail.invoice.failed,
    );
  }
}

/**
 * Rows the widget counts as „zum Anlegen“: a sure invoice with no invoice behind it at all. A deleted one
 * (the person's choice) and an unsure one (the sheet decides) do not count, so the number only goes down.
 */
export const toCreate = (offers: ReadonlyMap<string, InvoiceOffer>): number =>
  [...offers.values()].filter((o) => o.kind === 'create' && o.state === undefined).length;
