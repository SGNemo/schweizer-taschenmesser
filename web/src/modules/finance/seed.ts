import { addDaysStr, addMonthsToMonth, monthOf } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

// Fixed default ids/names, copied from SEED_CATEGORIES in ./repo.ts (this file must not import the
// repo): the finance defaults then find these records and never create duplicates.
const CATEGORIES = [
  ['cat-food', 'Lebensmittel', 'expense'],
  ['cat-home', 'Wohnen', 'expense'],
  ['cat-mobility', 'Mobilität', 'expense'],
  ['cat-leisure', 'Freizeit', 'expense'],
  ['cat-health', 'Gesundheit', 'expense'],
  ['cat-subs', 'Abos', 'expense'],
  ['cat-invoices', 'Rechnungen', 'expense'],
  ['cat-other', 'Sonstiges', 'expense'],
  ['cat-salary', 'Gehalt', 'income'],
  ['cat-income-other', 'Sonstige Einnahmen', 'income'],
] as const;

interface Tx {
  accountId: string;
  categoryId: string;
  kind: 'expense' | 'income';
  amountMinor: number;
  date: string;
  payee: string;
  note?: string;
}

/** Variable spending: [category, payees, min cents, max cents, weight, notes]. */
const EXTRAS: readonly (readonly [string, readonly string[], number, number, number])[] = [
  [
    'cat-food',
    [
      'Supermarkt Mühlenfeld',
      'Biomarkt Grünhof',
      'Bäckerei Sonnenschein',
      'Wochenmarkt',
      'Discounter Preisblick',
    ],
    350,
    6800,
    10,
  ],
  [
    'cat-mobility',
    ['Tankstelle Nordring', 'Deutsche Bahn Beispiel', 'Stadtwerke ÖPNV', 'Parkhaus Zentrum'],
    300,
    7500,
    4,
  ],
  [
    'cat-leisure',
    [
      'Kino Lichtspiele',
      'Restaurant Zum Anker',
      'Buchhandlung Seitenblick',
      'Café Morgenrot',
      'Sportartikel Fuchs',
    ],
    500,
    6500,
    5,
  ],
  [
    'cat-health',
    ['Apotheke am Markt', 'Drogerie Rosenstein', 'Physiopraxis Beispiel'],
    400,
    4500,
    2,
  ],
  [
    'cat-other',
    ['Baumarkt Heimwerk', 'Geschenke & Mehr', 'Schreibwaren Tinte', 'Friseur Kammgold'],
    600,
    5500,
    2,
  ],
];
const WEIGHT_SUM = EXTRAS.reduce((n, e) => n + e[4], 0);

function seed(ctx: SeedContext): SeedRows {
  const accountIds = {
    main: 'acc-main',
    savings: ctx.id('finance', 'account', 'savings'),
    cash: ctx.id('finance', 'account', 'cash'),
  };
  const accounts: SeedRow[] = [
    { id: accountIds.main, data: { name: 'Girokonto', openingBalanceMinor: 120000, order: 0 } },
    { id: accountIds.savings, data: { name: 'Sparkonto', openingBalanceMinor: 850000, order: 1 } },
    { id: accountIds.cash, data: { name: 'Bargeld', openingBalanceMinor: 6000, order: 2 } },
  ];
  const categories: SeedRow[] = CATEGORIES.map(([id, name, kind]) => ({
    id,
    data: { name, kind },
  }));

  const months = ctx.count({ small: 2, medium: 4, large: 12 });
  const thisMonth = monthOf(ctx.today);
  const txs: Tx[] = [];
  const add = (t: Tx) => txs.push(t);

  // Fixed monthly items on the 1st. The current month always has them (the 1st is never after
  // today), so the home widgets and budgets are filled on any day of the month.
  for (let m = 0; m < months; m++) {
    const month = addMonthsToMonth(thisMonth, -m);
    const first = `${month}-01`;
    const main = accountIds.main;
    add({
      accountId: main,
      categoryId: 'cat-salary',
      kind: 'income',
      amountMinor: 285000,
      date: first,
      payee: 'Musterfirma GmbH',
      note: 'Gehalt',
    });
    add({
      accountId: main,
      categoryId: 'cat-home',
      kind: 'expense',
      amountMinor: 85000,
      date: first,
      payee: 'Hausverwaltung Beispiel',
      note: 'Miete',
    });
    add({
      accountId: main,
      categoryId: 'cat-home',
      kind: 'expense',
      amountMinor: 6500,
      date: first,
      payee: 'Stadtwerke Musterstadt',
      note: 'Strom & Wasser',
    });
    add({
      accountId: main,
      categoryId: 'cat-subs',
      kind: 'expense',
      amountMinor: 1299,
      date: first,
      payee: 'Streaming Plus',
      note: 'Abo',
    });
    add({
      accountId: main,
      categoryId: 'cat-subs',
      kind: 'expense',
      amountMinor: 1099,
      date: first,
      payee: 'Musik Flat',
      note: 'Abo',
    });
    add({
      accountId: main,
      categoryId: 'cat-leisure',
      kind: 'expense',
      amountMinor: m === 0 ? 9500 : ctx.rng.int(2500, 9000),
      date: first,
      payee: 'Konzertkasse Nord',
      note: 'Tickets',
    });
    if (m > 0 && ctx.rng.chance(0.5))
      add({
        accountId: main,
        categoryId: 'cat-income-other',
        kind: 'income',
        amountMinor: ctx.rng.int(1500, 12000),
        date: `${month}-15`,
        payee: 'Steuererstattung Beispiel',
      });
    if (m % 3 === 0)
      add({
        accountId: accountIds.savings,
        categoryId: 'cat-income-other',
        kind: 'income',
        amountMinor: ctx.rng.int(800, 2500),
        date: first,
        payee: 'Sparkasse Beispiel',
        note: 'Zinsen',
      });
  }
  // A couple of entries for "today" and "yesterday".
  add({
    accountId: accountIds.main,
    categoryId: 'cat-food',
    kind: 'expense',
    amountMinor: 1840,
    date: ctx.today,
    payee: 'Bäckerei Sonnenschein',
  });
  add({
    accountId: accountIds.cash,
    categoryId: 'cat-leisure',
    kind: 'expense',
    amountMinor: 1250,
    date: ctx.day(-1),
    payee: 'Café Morgenrot',
  });
  add({
    accountId: accountIds.main,
    categoryId: 'cat-mobility',
    kind: 'expense',
    amountMinor: 6120,
    date: ctx.day(-1),
    payee: 'Tankstelle Nordring',
    note: 'Tanken',
  });

  const target = ctx.count({ small: 10, medium: 60, large: 5000 });
  const startOfWindow = `${addMonthsToMonth(thisMonth, -(months - 1))}-01`;
  const span = Math.max(1, daysFrom(startOfWindow, ctx.today));
  while (txs.length < target) {
    // Spread over the window, newest first not required; never in the future.
    const date = addDaysStr(startOfWindow, ctx.rng.int(0, span));
    let pick = ctx.rng.int(1, WEIGHT_SUM);
    const e = EXTRAS.find((x) => (pick -= x[4]) <= 0)!;
    add({
      accountId: ctx.rng.chance(0.15) ? accountIds.cash : accountIds.main,
      categoryId: e[0],
      kind: 'expense',
      amountMinor: ctx.rng.int(e[2], e[3]),
      date,
      payee: ctx.rng.pick(e[1]),
    });
  }

  return {
    account: accounts,
    category: categories,
    transaction: txs.map((t, i) => ({
      id: ctx.id('finance', 'transaction', i),
      data: { ...t },
    })),
  };
}

function daysFrom(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb!, mb! - 1, db!) - Date.UTC(ya!, ma! - 1, da!)) / 86400000);
}

export default { seed } satisfies SeedModule;
