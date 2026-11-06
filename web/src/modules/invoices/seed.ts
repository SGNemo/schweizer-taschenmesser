import type { KnownLang } from '@/core/i18n/lang';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

/** Source text and its translations (en, es, fr, pt-BR); `seed` picks by language. */
const L = (
  de: string,
  en: string,
  es: string,
  fr: string,
  pt: string,
): Record<KnownLang, string> => ({
  de,
  en,
  es,
  fr,
  'pt-BR': pt,
});

/** [payee, min cents, max cents, reference prefix] */
const PAYEES: readonly (readonly [Record<KnownLang, string>, number, number, string])[] = [
  [
    L(
      'Stadtwerke Musterstadt',
      'Musterstadt Utilities',
      'Suministros Musterstadt',
      'Services municipaux Musterstadt',
      'Serviços Municipais Musterstadt',
    ),
    4500,
    21000,
    'SW',
  ],
  [
    L(
      'Hausverwaltung Beispiel',
      'Beispiel Property Management',
      'Administración de fincas Beispiel',
      'Syndic Beispiel',
      'Administradora Beispiel',
    ),
    9000,
    48000,
    'HV',
  ],
  [
    L(
      'Zahnarztpraxis Dr. Beispiel',
      'Dr. Beispiel Dental Practice',
      'Clínica dental Dr. Beispiel',
      'Cabinet dentaire Dr Beispiel',
      'Consultório odontológico Dr. Beispiel',
    ),
    3500,
    28000,
    'ZA',
  ],
  [
    L(
      'Kfz-Versicherung Nordstern',
      'Nordstern Car Insurance',
      'Seguro de coche Nordstern',
      'Assurance auto Nordstern',
      'Seguro de carro Nordstern',
    ),
    12000,
    62000,
    'KV',
  ],
  [
    L(
      'Internet & Telefon Küstennetz',
      'Küstennetz Internet & Phone',
      'Internet y teléfono Küstennetz',
      'Internet et téléphone Küstennetz',
      'Internet e telefone Küstennetz',
    ),
    2999,
    4999,
    'KN',
  ],
  [
    L(
      'Werkstatt Radlager',
      'Radlager Workshop',
      'Taller Radlager',
      'Atelier Radlager',
      'Oficina Radlager',
    ),
    4500,
    38000,
    'WR',
  ],
  [
    L(
      'Steuerberatung Muster & Kollegen',
      'Muster & Partners Tax Advisers',
      'Asesoría fiscal Muster y Asociados',
      'Cabinet fiscal Muster & Associés',
      'Contabilidade Muster & Associados',
    ),
    15000,
    90000,
    'ST',
  ],
  [
    L(
      'Tierarztpraxis Pfotenglück',
      'Pfotenglück Vet Practice',
      'Clínica veterinaria Pfotenglück',
      'Cabinet vétérinaire Pfotenglück',
      'Clínica veterinária Pfotenglück',
    ),
    3000,
    24000,
    'TP',
  ],
  [
    L(
      'Schornsteinfeger Beispielstadt',
      'Beispielstadt Chimney Sweep',
      'Deshollinador Beispielstadt',
      'Ramoneur Beispielstadt',
      'Limpador de chaminés Beispielstadt',
    ),
    4000,
    9000,
    'SF',
  ],
];

/** Fixed head of the list so every state (overdue, soon, later, paid) exists even at small scale. */
const HEAD: readonly {
  payee: number;
  amount: number;
  due: number;
  paidDaysAgo?: number;
  /** Part payment (cents, paid this many days ago) and reminder level. */
  part?: { amount: number; daysAgo: number };
  dunning?: number;
  iban?: boolean;
}[] = [
  { payee: 0, amount: 8740, due: -12, dunning: 1, iban: true },
  { payee: 2, amount: 13250, due: -3, part: { amount: 5000, daysAgo: 5 } },
  { payee: 4, amount: 3999, due: 2 },
  { payee: 3, amount: 41800, due: 6, iban: true },
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
    const [payeeNames, , , prefix] = PAYEES[payeeIdx]!;
    const payee = payeeNames[ctx.lang];
    const dueDate = ctx.day(due);
    invoices.push({
      id,
      data: {
        payee,
        amountMinor: amount,
        dueDate,
        status: paidAt ? 'paid' : 'open',
        ...(paidAt ? { paidAt } : {}),
        ...(head?.part
          ? {
              payments: [
                {
                  id: ctx.id('invoices', 'payment', i),
                  date: ctx.day(-head.part.daysAgo),
                  amountMinor: head.part.amount,
                },
              ],
            }
          : {}),
        ...(head?.dunning ? { dunningLevel: head.dunning, dunnedAt: ctx.day(-2) } : {}),
        // The published example IBAN of the German banking standard, not a real account.
        ...(head?.iban ? { iban: 'DE89370400440532013000' } : {}),
        reference: `${prefix}-2026-${String(1000 + i)}`,
        ...(i % 4 === 0
          ? {
              note: L(
                'Per Überweisung begleichen',
                'Pay by bank transfer',
                'Pagar por transferencia',
                'Payer par virement',
                'Pagar por transferência',
              )[ctx.lang],
            }
          : {}),
      },
    });
    if (head?.part) {
      // The part payment's own booking (`inv-<invoiceId>-<paymentId>`), as the invoice.payment handler makes it.
      bookings.push({
        id: `inv-${id}-${ctx.id('invoices', 'payment', i)}`,
        data: {
          accountId: 'acc-main',
          categoryId: 'cat-invoices',
          kind: 'expense',
          amountMinor: head.part.amount,
          date: ctx.day(-head.part.daysAgo),
          payee,
          sourceRef: `invoice:${id}`,
        },
      });
    }
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
