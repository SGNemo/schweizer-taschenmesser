import type { Lang } from '@/core/i18n/lang';
import type { Recurrence } from '@/core/recurrence/types';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const monthly = (interval = 1): Recurrence => ({ freq: 'monthly', interval });
const yearly: Recurrence = { freq: 'yearly', interval: 1 };

/** Source text and its translations (en, es, fr, pt-BR); `seed` picks by language. */
const L = (de: string, en: string, es: string, fr: string, pt: string): Record<Lang, string> => ({
  de,
  en,
  es,
  fr,
  'pt-BR': pt,
});

/** [name, cents, rule, days since the last charge (startDate), cancel notice days, active] */
const BASE: readonly (readonly [
  Record<Lang, string>,
  number,
  Recurrence,
  number,
  number | undefined,
  boolean,
])[] = [
  [
    L('Streaming Plus', 'Streaming Plus', 'Streaming Plus', 'Streaming Plus', 'Streaming Plus'),
    1299,
    monthly(),
    26,
    30,
    true,
  ],
  [
    L(
      'Musik Flat',
      'Music Unlimited',
      'Música sin límites',
      'Musique illimitée',
      'Música ilimitada',
    ),
    1099,
    monthly(),
    15,
    30,
    true,
  ],
  [
    L(
      'Cloud-Speicher 200 GB',
      'Cloud storage 200 GB',
      'Almacenamiento en la nube 200 GB',
      'Stockage cloud 200 Go',
      'Armazenamento na nuvem 200 GB',
    ),
    299,
    monthly(),
    8,
    undefined,
    true,
  ],
  [
    L(
      'Fitnessstudio Aktiv',
      'Aktiv Gym',
      'Gimnasio Aktiv',
      'Salle de sport Aktiv',
      'Academia Aktiv',
    ),
    2990,
    monthly(),
    3,
    30,
    true,
  ],
  [
    L(
      'Wochenzeitung Nordbote',
      'Weekly paper Nordbote',
      'Semanario Nordbote',
      'Hebdomadaire Nordbote',
      'Semanário Nordbote',
    ),
    4590,
    monthly(3),
    40,
    42,
    true,
  ],
  [
    L(
      'Handyvertrag Küstenmobil',
      'Mobile plan Küstenmobil',
      'Tarifa móvil Küstenmobil',
      'Forfait mobile Küstenmobil',
      'Plano de celular Küstenmobil',
    ),
    1990,
    monthly(),
    12,
    90,
    true,
  ],
  [
    L(
      'Haftpflichtversicherung',
      'Liability insurance',
      'Seguro de responsabilidad civil',
      'Assurance responsabilité civile',
      'Seguro de responsabilidade civil',
    ),
    6900,
    yearly,
    200,
    90,
    true,
  ],
  [
    L(
      'Hörbuch-Flat',
      'Audiobook plan',
      'Tarifa de audiolibros',
      'Abonnement livres audio',
      'Plano de audiolivros',
    ),
    995,
    monthly(),
    22,
    30,
    false,
  ],
  [
    L(
      'Domain & Webspace',
      'Domain & web hosting',
      'Dominio y alojamiento web',
      'Domaine et hébergement web',
      'Domínio e hospedagem web',
    ),
    3600,
    yearly,
    300,
    30,
    true,
  ],
];
const EXTRA_NAMES = [
  L(
    'Zeitschriften-Abo',
    'Magazine subscription',
    'Suscripción a revista',
    'Abonnement magazine',
    'Assinatura de revista',
  ),
  L(
    'Lernplattform',
    'Learning platform',
    'Plataforma de aprendizaje',
    'Plateforme d’apprentissage',
    'Plataforma de estudos',
  ),
  L('Kochbox', 'Meal kit', 'Caja de cocina', 'Panier repas', 'Kit de refeições'),
  L('Spiele-Pass', 'Game pass', 'Pase de juegos', 'Pass jeux', 'Passe de jogos'),
  L(
    'Vereinsbeitrag',
    'Club membership',
    'Cuota del club',
    'Cotisation du club',
    'Mensalidade do clube',
  ),
];

/** Extra names get the row number behind them in every language. */
const numbered = (names: Record<Lang, string>, i: number): Record<Lang, string> =>
  Object.fromEntries(Object.entries(names).map(([k, v]) => [k, `${v} ${i}`])) as Record<
    Lang,
    string
  >;

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 4, medium: 9, large: 60 });
  const rows = Array.from({ length: n }, (_, i) => {
    const base = BASE[i];
    const [label, amountMinor, recurrence, ago, notice, active] = base ?? [
      numbered(ctx.rng.pick(EXTRA_NAMES), i),
      ctx.rng.int(299, 4999),
      ctx.rng.chance(0.2) ? yearly : monthly(),
      ctx.rng.int(1, 28),
      ctx.rng.chance(0.5) ? 30 : undefined,
      ctx.rng.chance(0.85),
    ];
    return {
      id: ctx.id('subscriptions', 'subscription', i),
      data: {
        name: label[ctx.lang],
        amountMinor,
        recurrence,
        startDate: ctx.day(-ago),
        ...(notice !== undefined ? { cancelNoticeDays: notice } : {}),
        active,
      },
    };
  });
  // Small scale must still contain one cancelled subscription.
  if (n < BASE.length) {
    const last = rows[n - 1]!;
    last.data = { ...last.data, active: false };
  }
  // Charges are a live forecast (finance reads them via subscriptions/public.ts and never books
  // them), so no finance.transaction rows are seeded here.
  return { subscription: rows };
}

export default { seed } satisfies SeedModule;
