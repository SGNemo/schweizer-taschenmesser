import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const FIRST = [
  'Anna',
  'Lukas',
  'Mira',
  'Jonas',
  'Clara',
  'Felix',
  'Lena',
  'Paul',
  'Sophie',
  'Max',
  'Nora',
  'Tim',
  'Emma',
  'Leon',
  'Hanna',
  'Ben',
  'Marie',
  'Elias',
  'Greta',
  'Oskar',
  'Ida',
  'Finn',
  'Johanna',
  'Theo',
  'Luise',
  'Moritz',
  'Frieda',
  'Karl',
  'Rosa',
  'Niko',
];
const LAST = [
  'Beispiel',
  'Musterfrau',
  'Testmann',
  'Lindner',
  'Bergmann',
  'Sonnleitner',
  'Waldmeier',
  'Kaltenbach',
  'Rosenau',
  'Fichtner',
  'Brunnhuber',
  'Lerchenfeld',
  'Auerbacher',
  'Seidlmayr',
];
const NOTES = [
  'Kollegin',
  'Nachbar',
  'Cousine',
  'Schulfreund',
  'Sportverein',
  'Onkel',
  'Patenkind',
];
/** Days from today to the next birthday: some inside 7 and 30 days, some later, one today. */
const SOON = [0, 2, 5, 9, 16, 24, 41, 75];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 8, medium: 28, large: 300 });
  const todayYear = Number(ctx.today.slice(0, 4));
  const rows = Array.from({ length: n }, (_, i) => {
    const offset = i < SOON.length ? SOON[i]! : ctx.rng.int(1, 364);
    const [, m, d] = ctx.day(offset).split('-').map(Number) as [number, number, number];
    const first = FIRST[i % FIRST.length]!;
    const last = i < FIRST.length ? LAST[i % LAST.length]! : `${ctx.rng.pick(LAST)}`;
    const data: Record<string, unknown> = { name: `${first} ${last}`, month: m, day: d };
    if (ctx.rng.chance(0.7)) data.year = todayYear - ctx.rng.int(4, 80);
    if (ctx.rng.chance(0.3)) data.note = ctx.rng.pick(NOTES);
    return { id: ctx.id('birthdays', 'birthday', i), data };
  });
  return { birthday: rows };
}

export default { seed } satisfies SeedModule;
