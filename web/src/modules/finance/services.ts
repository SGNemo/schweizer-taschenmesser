import { transaction } from '@/core/db/repo';
import { bus } from '@/core/events';
import { currencyOf } from '@/core/money';
import { today } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { listInvoicePayments, paidInvoiceBookingOn } from '@/modules/invoices/public';
import { getSettings } from '@/core/settings/settings';
import { addDaysStr } from '@/core/time/dates';
import { listSubscriptionCharges } from '@/modules/subscriptions/public';
import { chargeAlreadyBooked } from './subscriptionLink';
import { settings } from './settings';
import { accountRepo } from './repo';
import { planRepeats } from './logic';
import { normalizePayee } from './rules';
import {
  categoryRepo,
  ensureDefaults,
  INVOICE_CATEGORY_ID,
  SUBSCRIPTIONS_CATEGORY_ID,
  primaryAccountId,
  transactionRepo,
} from './repo';

/** Transaction ids derived from invoice ids make bookings idempotent and convergent across devices. */
export const invoiceTransactionId = (invoiceId: string, paymentId?: string): string =>
  paymentId ? `inv-${invoiceId}-${paymentId}` : `inv-${invoiceId}`;

/** Books (or updates) the expense for a paid invoice. */
export async function bookInvoiceExpense(p: {
  invoiceId: string;
  payee: string;
  amountMinor: number;
  paidAt: string;
  note?: string;
  currency?: string;
  /** Set for a part payment: it gets its own booking next to the one for the rest. */
  paymentId?: string;
}): Promise<void> {
  await ensureDefaults();
  const id = invoiceTransactionId(p.invoiceId, p.paymentId);
  const existing = await transactionRepo.table.get(id);
  if (existing) {
    if (existing.deletedAt !== null) await transactionRepo.restore(id);
    // Keep account and category the user may have changed; only sync what the invoice owns.
    await transactionRepo.update(id, {
      amountMinor: p.amountMinor,
      date: p.paidAt,
      payee: p.payee,
      note: p.note,
    });
    return;
  }
  const categoryId = (await categoryRepo.get(INVOICE_CATEGORY_ID))
    ? INVOICE_CATEGORY_ID
    : undefined;
  await transactionRepo.create(
    {
      accountId: await primaryAccountId(currencyOf(p.currency)),
      categoryId,
      kind: 'expense',
      amountMinor: p.amountMinor,
      date: p.paidAt,
      payee: p.payee,
      note: p.note,
      sourceRef: `invoice:${p.invoiceId}`,
    },
    { id },
  );
}

/**
 * A repeating booking (rent, insurance) with the same payee and amount already stands for this
 * payment: booking the paid invoice too would count it twice.
 */
export async function coveredByRepeatingBooking(p: {
  payee: string;
  amountMinor: number;
}): Promise<boolean> {
  const payee = normalizePayee(p.payee);
  if (!payee) return false;
  return (await transactionRepo.active().toArray()).some(
    (x) =>
      (x.repeat || x.repeatOf) &&
      x.kind === 'expense' &&
      x.amountMinor === p.amountMinor &&
      normalizePayee(x.payee ?? '') === payee,
  );
}

/** Removes the expense of a reopened invoice. */
export async function removeInvoiceExpense(invoiceId: string): Promise<void> {
  const id = invoiceTransactionId(invoiceId);
  if (await transactionRepo.get(id)) await transactionRepo.remove(id);
}

/**
 * Books the next entries of repeating bookings (rent, salary) whose date has come. Runs when the
 * module starts; a toast says how many were added and offers "Rückgängig".
 */
export async function bookDueRepeats(): Promise<number> {
  const heads = (await transactionRepo.active().toArray()).filter((x) => x.repeat);
  const { create, clear } = planRepeats(heads, today());
  const fresh: typeof create = [];
  for (const p of create) if (!(await transactionRepo.table.get(p.id))) fresh.push(p);
  if (fresh.length === 0 && clear.length === 0) return 0;
  const message = t.finance.repeatBooked(fresh.length);
  // One transaction: a crash between "the repeat moves on" and "the new entries exist" can not lose a repeat.
  const apply = () =>
    transaction([transactionRepo], async () => {
      for (const id of clear) await transactionRepo.update(id, { repeat: undefined });
      for (const p of fresh) await transactionRepo.create(p.data, { id: p.id });
    });
  if (fresh.length > 0) await undoableWithToast(message, message, apply);
  else await apply();
  return fresh.length;
}

/** Booking id of a subscription charge: the same charge books once on every device, and a deleted one is not brought back. */
export const subscriptionTransactionId = (subscriptionId: string, date: string): string =>
  `sub-${subscriptionId}-${date}`;

/** Charges younger than this are booked when the setting is on (older ones are history, not news). */
const SUBSCRIPTION_BOOK_DAYS = 31;

/**
 * With the setting "Abo-Abbuchungen buchen" on: books the charges of the last month that no booking
 * stands for yet (same service and amount within three days, e.g. from a bank import). Idempotent by
 * id; a booking the user deleted stays deleted. A toast says how many and offers "Rückgängig".
 */
export async function bookDueSubscriptionCharges(): Promise<number> {
  const prefs = await getSettings('module.finance', settings.schema, settings.defaults);
  if (!prefs.bookSubscriptions) return 0;
  const day = today();
  const from = addDaysStr(day, -SUBSCRIPTION_BOOK_DAYS);
  const accounts = await accountRepo.active().toArray();
  const currencies = [...new Set(accounts.map((a) => currencyOf(a)))];
  const existing = await transactionRepo.active().toArray();
  const fresh: {
    id: string;
    currency: string;
    name: string;
    subscriptionId: string;
    amountMinor: number;
    date: string;
  }[] = [];
  for (const currency of currencies) {
    for (const c of await listSubscriptionCharges(from, day, currency)) {
      const id = subscriptionTransactionId(c.subscriptionId, c.date);
      if (await transactionRepo.table.get(id)) continue;
      if (chargeAlreadyBooked(c, existing)) continue;
      fresh.push({ ...c, id, currency });
    }
  }
  if (fresh.length === 0) return 0;
  await ensureDefaults();
  const category = (await categoryRepo.get(SUBSCRIPTIONS_CATEGORY_ID))
    ? SUBSCRIPTIONS_CATEGORY_ID
    : undefined;
  const message = t.finance.ext.subBooked(fresh.length);
  await undoableWithToast(message, message, async () => {
    // Accounts are looked up (and created if missing) first: a transaction only holds the bookings.
    const accountOf = new Map<string, string>();
    for (const c of fresh)
      if (!accountOf.has(c.currency)) accountOf.set(c.currency, await primaryAccountId(c.currency));
    await transaction([transactionRepo], async () => {
      for (const c of fresh)
        await transactionRepo.create(
          {
            accountId: accountOf.get(c.currency)!,
            categoryId: category,
            kind: 'expense',
            amountMinor: c.amountMinor,
            date: c.date,
            payee: c.name,
            sourceRef: `subscription:${c.subscriptionId}`,
          },
          { id: c.id },
        );
    });
  });
  return fresh.length;
}

/**
 * Books what the invoice events should have booked but did not: the app closed between "invoice
 * saved as paid" and "finance books it", and the event is gone. Idempotent: a payment that has a
 * booking (also a deleted one: the user's choice stays) is left alone; the same rules as the event
 * handlers apply (setting on, no double booking with a repeating booking for the rest).
 */
export async function repairInvoiceBookings(): Promise<number> {
  if (!(await paidInvoiceBookingOn())) return 0;
  let booked = 0;
  for (const p of await listInvoicePayments()) {
    if (await transactionRepo.table.get(invoiceTransactionId(p.invoiceId, p.paymentId))) continue;
    if (!p.paymentId && (await coveredByRepeatingBooking(p))) continue;
    await bookInvoiceExpense({ ...p, paidAt: p.paidAt });
    booked++;
  }
  return booked;
}

/** Runs while the finance module is enabled: reacts to invoice events from the bus. */
export default function start(): () => void {
  void bookDueRepeats()
    .then(() => bookDueSubscriptionCharges())
    .then(() => repairInvoiceBookings());
  const offPaid = bus.on('invoice.paid', async (p) => {
    // Only while Finances is on (this service runs only then) and the user keeps the invoice
    // setting on; an existing booking of this invoice is left to `bookInvoiceExpense` (idempotent).
    if (!(await paidInvoiceBookingOn())) return;
    // Part payments covered everything: nothing is left to book (and an earlier booking of the rest goes).
    if (p.amountMinor < 1) return removeInvoiceExpense(p.invoiceId);
    if (!(await transactionRepo.table.get(invoiceTransactionId(p.invoiceId))))
      if (await coveredByRepeatingBooking(p)) return;
    await bookInvoiceExpense(p);
  });
  const offUnpaid = bus.on('invoice.unpaid', ({ invoiceId }) => removeInvoiceExpense(invoiceId));
  const offPayment = bus.on('invoice.payment', async (p) => {
    if (!(await paidInvoiceBookingOn())) return;
    await bookInvoiceExpense({ ...p, paidAt: p.date });
  });
  const offPaymentRemoved = bus.on('invoice.paymentRemoved', async ({ invoiceId, paymentId }) => {
    const id = invoiceTransactionId(invoiceId, paymentId);
    if (await transactionRepo.get(id)) await transactionRepo.remove(id);
  });
  return () => {
    offPaid();
    offUnpaid();
    offPayment();
    offPaymentRemoved();
  };
}
