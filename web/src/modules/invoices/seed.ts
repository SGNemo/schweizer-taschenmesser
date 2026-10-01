import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

/** [payee, min cents, max cents, reference prefix] */
const PAYEES: readonly (readonly [string, number, number, string])[] = [
  ['Stadtwerke Musterstadt', 4500, 21000, 'SW'],
  ['Hausverwaltung Beispiel', 9000, 48000, 'HV'],
  ['Zahnarztpraxis Dr. Beispiel', 3500, 28000, 'ZA'],
  ['Kfz-Versicherung Nordstern', 12000, 62000, 'KV'],
  ['Internet & Telefon Küstennetz', 2999, 4999, 'KN'],
  ['Werkstatt Radlager', 4500, 38000, 'WR'],
  ['Steuerberatung Muster & Kollegen', 15000, 90000, 'ST'],
  ['Tierarztpraxis Pfotenglück', 3000, 24000, 'TP'],
  ['Schornsteinfeger Beispielstadt', 4000, 9000, 'SF'],
];

/** Fixed head of the list so every state (overdue, soon, later, paid) exists even at small scale. */
const HEAD: readonly { payee: number; amount: number; due: number; paidDaysAgo?: number }[] = [
  { payee: 0, amount: 8740, due: -12 },
  { payee: 2, amount: 13250, due: -3 },
  { payee: 4, amount: 3999, due: 2 },
  { payee: 3, amount: 41800, due: 6 },
  { payee: 1, amount: 22000, due: 25 },
  { payee: 5, amount: 18990, due: -20, paidDaysAgo: 18 },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 24, large: 300 });
  const invoices: SeedRow[] = [];
  const bookings: SeedRow[] = [];

  for (let i = 0; i < n; i++) {
    const id = ctx.id('invoices', 'invoice', i);
    const head = HEAD[i];
    let payeeIdx: number;
    let amount: number;
    let due: number;
    let paidAt: string | undefined;
    if (head) {
      payeeIdx = head.payee;
      amount = head.amount;
      due = head.due;
      if (head.paidDaysAgo !== undefined) paidAt = ctx.day(-head.paidDaysAgo);
    } else {
      payeeIdx = ctx.rng.int(0, PAYEES.length - 1);
      const [, min, max] = PAYEES[payeeIdx]!;
      amount = ctx.rng.int(min, max);
      if (ctx.rng.chance(0.65)) {
        due = -ctx.rng.int(5, 240);
        paidAt = ctx.day(due + ctx.rng.int(0, 4));
      } else {
        due = ctx.rng.chance(0.12) ? -ctx.rng.int(1, 30) : ctx.rng.int(1, 60);
      }
    }
    const [payee, , , prefix] = PAYEES[payeeIdx]!;
    const dueDate = ctx.day(due);
    invoices.push({
      id,
      data: {
        payee,
        amountMinor: amount,
        dueDate,
        status: paidAt ? 'paid' : 'open',
        ...(paidAt ? { paidAt } : {}),
        reference: `${prefix}-2026-${String(1000 + i)}`,
        ...(i % 4 === 0 ? { note: 'Per Überweisung begleichen' } : {}),
      },
    });
    if (paidAt) {
      // What finance's invoice.paid handler books (invoiceTransactionId = `inv-<invoiceId>`).
      bookings.push({
        id: `inv-${id}`,
        data: {
          accountId: 'acc-main',
          categoryId: 'cat-invoices',
          kind: 'expense',
          amountMinor: amount,
          date: paidAt,
          payee,
          sourceRef: `invoice:${id}`,
        },
      });
    }
  }
  return { invoice: invoices, 'finance.transaction': bookings };
}

export default { seed } satisfies SeedModule;
