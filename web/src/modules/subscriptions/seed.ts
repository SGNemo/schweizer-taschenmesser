import type { Recurrence } from '@/core/recurrence/types';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const monthly = (interval = 1): Recurrence => ({ freq: 'monthly', interval });
const yearly: Recurrence = { freq: 'yearly', interval: 1 };

/** [name, cents, rule, days since the last charge (startDate), cancel notice days, active] */
const BASE: readonly (readonly [
  string,
  number,
  Recurrence,
  number,
  number | undefined,
  boolean,
])[] = [
  ['Streaming Plus', 1299, monthly(), 26, 30, true],
  ['Musik Flat', 1099, monthly(), 15, 30, true],
  ['Cloud-Speicher 200 GB', 299, monthly(), 8, undefined, true],
  ['Fitnessstudio Aktiv', 2990, monthly(), 3, 30, true],
  ['Wochenzeitung Nordbote', 4590, monthly(3), 40, 42, true],
  ['Handyvertrag Küstenmobil', 1990, monthly(), 12, 90, true],
  ['Haftpflichtversicherung', 6900, yearly, 200, 90, true],
  ['Hörbuch-Flat', 995, monthly(), 22, 30, false],
  ['Domain & Webspace', 3600, yearly, 300, 30, true],
];
const EXTRA_NAMES = [
  'Zeitschriften-Abo',
  'Lernplattform',
  'Kochbox',
  'Spiele-Pass',
  'Vereinsbeitrag',
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 4, medium: 9, large: 60 });
  const rows = Array.from({ length: n }, (_, i) => {
    const base = BASE[i];
    const [name, amountMinor, recurrence, ago, notice, active] = base ?? [
      `${ctx.rng.pick(EXTRA_NAMES)} ${i}`,
      ctx.rng.int(299, 4999),
      ctx.rng.chance(0.2) ? yearly : monthly(),
      ctx.rng.int(1, 28),
      ctx.rng.chance(0.5) ? 30 : undefined,
      ctx.rng.chance(0.85),
    ];
    return {
      id: ctx.id('subscriptions', 'subscription', i),
      data: {
        name,
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
