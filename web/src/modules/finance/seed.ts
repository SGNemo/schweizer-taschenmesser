import { addDaysStr, addMonthsToMonth, monthOf } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German. */
const TR: Record<string, readonly [string, string, string, string]> = {
  Lebensmittel: ['Groceries', 'Alimentación', 'Alimentation', 'Alimentação'],
  Wohnen: ['Housing', 'Vivienda', 'Logement', 'Moradia'],
  Mobilität: ['Mobility', 'Movilidad', 'Mobilité', 'Mobilidade'],
  Freizeit: ['Leisure', 'Ocio', 'Loisirs', 'Lazer'],
  Gesundheit: ['Health', 'Salud', 'Santé', 'Saúde'],
  Abos: ['Subscriptions', 'Suscripciones', 'Abonnements', 'Assinaturas'],
  Rechnungen: ['Bills', 'Facturas', 'Factures', 'Contas'],
  Sonstiges: ['Other', 'Otros', 'Divers', 'Outros'],
  Gehalt: ['Salary', 'Sueldo', 'Salaire', 'Salário'],
  Nebenjob: ['Side job', 'Trabajo extra', 'Job d’appoint', 'Trabalho extra'],
  'BAföG / Stipendium': [
    'Student grant',
    'Beca de estudios',
    'Bourse d’études',
    'Bolsa de estudos',
  ],
  'Sonstige Einnahmen': ['Other income', 'Otros ingresos', 'Autres revenus', 'Outras receitas'],
  Girokonto: ['Checking account', 'Cuenta corriente', 'Compte courant', 'Conta corrente'],
  Sparkonto: ['Savings account', 'Cuenta de ahorro', 'Compte d’épargne', 'Conta poupança'],
  Bargeld: ['Cash', 'Efectivo', 'Espèces', 'Dinheiro'],
  'Musterfirma GmbH': [
    'Musterfirma Ltd',
    'Musterfirma S.L.',
    'Musterfirma SARL',
    'Musterfirma Ltda',
  ],
  Miete: ['Rent', 'Alquiler', 'Loyer', 'Aluguel'],
  'Hausverwaltung Beispiel': [
    'Beispiel Property Management',
    'Administración de fincas Beispiel',
    'Syndic Beispiel',
    'Administradora Beispiel',
  ],
  'Strom & Wasser': ['Electricity & water', 'Luz y agua', 'Électricité et eau', 'Luz e água'],
  'Stadtwerke Musterstadt': [
    'Musterstadt Utilities',
    'Suministros Musterstadt',
    'Services municipaux Musterstadt',
    'Serviços Municipais Musterstadt',
  ],
  Abo: ['Subscription', 'Suscripción', 'Abonnement', 'Assinatura'],
  'Musik Flat': ['Music Unlimited', 'Música sin límites', 'Musique illimitée', 'Música ilimitada'],
  'Konzertkasse Nord': [
    'Nord Concert Tickets',
    'Entradas de conciertos Nord',
    'Billetterie concerts Nord',
    'Bilheteria de shows Nord',
  ],
  Tickets: ['Tickets', 'Entradas', 'Billets', 'Ingressos'],
  'Steuererstattung Beispiel': [
    'Beispiel tax refund',
    'Devolución de impuestos Beispiel',
    'Remboursement d’impôts Beispiel',
    'Restituição de imposto Beispiel',
  ],
  'Sparkasse Beispiel': [
    'Beispiel Savings Bank',
    'Caja de ahorros Beispiel',
    'Caisse d’épargne Beispiel',
    'Caixa econômica Beispiel',
  ],
  Zinsen: ['Interest', 'Intereses', 'Intérêts', 'Juros'],
  'Bäckerei Sonnenschein': [
    'Sonnenschein Bakery',
    'Panadería Sonnenschein',
    'Boulangerie Sonnenschein',
    'Padaria Sonnenschein',
  ],
  'Café Morgenrot': ['Café Morgenrot', 'Café Morgenrot', 'Café Morgenrot', 'Café Morgenrot'],
  'Tankstelle Nordring': [
    'Nordring Petrol Station',
    'Gasolinera Nordring',
    'Station-service Nordring',
    'Posto Nordring',
  ],
  Tanken: ['Fuel', 'Gasolina', 'Carburant', 'Combustível'],
  'Supermarkt Mühlenfeld': [
    'Mühlenfeld Supermarket',
    'Supermercado Mühlenfeld',
    'Supermarché Mühlenfeld',
    'Supermercado Mühlenfeld',
  ],
  'Biomarkt Grünhof': [
    'Grünhof Organic Market',
    'Ecotienda Grünhof',
    'Magasin bio Grünhof',
    'Mercado orgânico Grünhof',
  ],
  Wochenmarkt: ['Weekly market', 'Mercadillo semanal', 'Marché hebdomadaire', 'Feira semanal'],
  'Discounter Preisblick': [
    'Preisblick Discount Store',
    'Supermercado económico Preisblick',
    'Discounter Preisblick',
    'Atacarejo Preisblick',
  ],
  'Deutsche Bahn Beispiel': [
    'Beispiel Railways',
    'Ferrocarriles Beispiel',
    'Chemins de fer Beispiel',
    'Ferrovias Beispiel',
  ],
  'Stadtwerke ÖPNV': [
    'City public transport',
    'Transporte público urbano',
    'Transports en commun de la ville',
    'Transporte público municipal',
  ],
  'Parkhaus Zentrum': [
    'Central car park',
    'Aparcamiento Centro',
    'Parking Centre',
    'Estacionamento Centro',
  ],
  'Kino Lichtspiele': [
    'Lichtspiele Cinema',
    'Cine Lichtspiele',
    'Cinéma Lichtspiele',
    'Cinema Lichtspiele',
  ],
  'Restaurant Zum Anker': [
    'Zum Anker Restaurant',
    'Restaurante Zum Anker',
    'Restaurant Zum Anker',
    'Restaurante Zum Anker',
  ],
  'Buchhandlung Seitenblick': [
    'Seitenblick Bookshop',
    'Librería Seitenblick',
    'Librairie Seitenblick',
    'Livraria Seitenblick',
  ],
  'Sportartikel Fuchs': [
    'Fuchs Sports Shop',
    'Deportes Fuchs',
    'Articles de sport Fuchs',
    'Artigos esportivos Fuchs',
  ],
  'Apotheke am Markt': [
    'Market Pharmacy',
    'Farmacia de la Plaza',
    'Pharmacie du Marché',
    'Farmácia da Praça',
  ],
  'Drogerie Rosenstein': [
    'Rosenstein Drugstore',
    'Droguería Rosenstein',
    'Droguerie Rosenstein',
    'Drogaria Rosenstein',
  ],
  'Physiopraxis Beispiel': [
    'Beispiel Physio Practice',
    'Fisioterapia Beispiel',
    'Cabinet de kiné Beispiel',
    'Clínica de fisioterapia Beispiel',
  ],
  'Baumarkt Heimwerk': [
    'Heimwerk DIY Store',
    'Ferretería Heimwerk',
    'Magasin de bricolage Heimwerk',
    'Loja de construção Heimwerk',
  ],
  'Geschenke & Mehr': ['Gifts & More', 'Regalos y más', 'Cadeaux & Co', 'Presentes e mais'],
  'Schreibwaren Tinte': [
    'Tinte Stationery',
    'Papelería Tinte',
    'Papeterie Tinte',
    'Papelaria Tinte',
  ],
  'Friseur Kammgold': [
    'Kammgold Hairdresser',
    'Peluquería Kammgold',
    'Coiffeur Kammgold',
    'Cabeleireiro Kammgold',
  ],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (ctx: SeedContext, de: string): string =>
  ctx.lang === 'de' ? de : (TR[de]?.[LANG_INDEX[ctx.lang]] ?? de);

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
  ['cat-side-job', 'Nebenjob', 'income'],
  ['cat-grant', 'BAföG / Stipendium', 'income'],
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
    {
      id: accountIds.main,
      data: { name: tr(ctx, 'Girokonto'), openingBalanceMinor: 120000, order: 0 },
    },
    {
      id: accountIds.savings,
      data: { name: tr(ctx, 'Sparkonto'), openingBalanceMinor: 850000, order: 1 },
    },
    {
      id: accountIds.cash,
      data: { name: tr(ctx, 'Bargeld'), openingBalanceMinor: 6000, order: 2 },
    },
  ];
  const categories: SeedRow[] = CATEGORIES.map(([id, name, kind]) => ({
    id,
    data: { name: tr(ctx, name), kind },
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
      data: {
        ...t,
        payee: tr(ctx, t.payee),
        ...(t.note ? { note: tr(ctx, t.note) } : {}),
      },
    })),
  };
}

function daysFrom(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb!, mb! - 1, db!) - Date.UTC(ya!, ma! - 1, da!)) / 86400000);
}

export default { seed } satisfies SeedModule;
