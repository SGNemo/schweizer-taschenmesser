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

type GiftStatus = 'idea' | 'bought' | 'given';

const GIFTS: {
  title: string;
  occasion: string;
  in: number;
  price: number;
  status: GiftStatus;
  note?: string;
}[] = [
  {
    title: 'Kochbuch "Italien einfach"',
    occasion: 'Geburtstag',
    in: 9,
    price: 2490,
    status: 'idea',
  },
  {
    title: 'Wanderrucksack 28 l',
    occasion: 'Geburtstag',
    in: 21,
    price: 8900,
    status: 'bought',
    note: 'Versteckt im Schrank',
  },
  {
    title: 'Gutschein Töpferkurs',
    occasion: 'Jubiläum',
    in: 34,
    price: 6500,
    status: 'idea',
  },
  {
    title: 'Gesellschaftsspiel für vier',
    occasion: 'Einweihung',
    in: 4,
    price: 3290,
    status: 'bought',
  },
  {
    title: 'Handgemachte Kerzen',
    occasion: 'Weihnachten',
    in: 84,
    price: 1800,
    status: 'idea',
  },
  {
    title: 'Fotokalender mit Familienbildern',
    occasion: 'Weihnachten',
    in: 84,
    price: 2200,
    status: 'idea',
  },
  {
    title: 'Bluetooth-Lautsprecher',
    occasion: 'Geburtstag',
    in: -12,
    price: 4900,
    status: 'given',
  },
  {
    title: 'Blumenstrauß und Karte',
    occasion: 'Dankeschön',
    in: 2,
    price: 1500,
    status: 'idea',
  },
  {
    title: 'Tee-Set mit Kanne',
    occasion: 'Abschied',
    in: 15,
    price: 3400,
    status: 'idea',
  },
  {
    title: 'Taschenlampe mit Dynamo',
    occasion: 'Geburtstag',
    in: 47,
    price: 1990,
    status: 'idea',
  },
  {
    title: 'Schal aus Merinowolle',
    occasion: 'Weihnachten',
    in: 84,
    price: 4500,
    status: 'bought',
  },
  {
    title: 'Konzertkarten',
    occasion: 'Geburtstag',
    in: -30,
    price: 7800,
    status: 'given',
  },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 8, medium: 28, large: 300 });
  const g = ctx.count({ small: 6, medium: 12, large: 90 });
  const todayYear = Number(ctx.today.slice(0, 4));
  const person = Array.from({ length: n }, (_, i) => {
    const offset = i < SOON.length ? SOON[i]! : ctx.rng.int(1, 364);
    const [, m, d] = ctx.day(offset).split('-').map(Number) as [number, number, number];
    const first = FIRST[i % FIRST.length]!;
    const last = i < FIRST.length ? LAST[i % LAST.length]! : `${ctx.rng.pick(LAST)}`;
    const birthday: Record<string, number> = { month: m, day: d };
    if (ctx.rng.chance(0.7)) birthday.year = todayYear - ctx.rng.int(4, 80);
    const data: Record<string, unknown> = { name: `${first} ${last}`, birthday };
    if (ctx.rng.chance(0.3)) data.note = ctx.rng.pick(NOTES);
    return { id: ctx.id('people', 'person', i), data };
  });
  const gift = Array.from({ length: g }, (_, i) => {
    const b = GIFTS[i % GIFTS.length]!;
    const round = Math.floor(i / GIFTS.length);
    return {
      id: ctx.id('people', 'gift', i),
      data: {
        personId: ctx.id('people', 'person', i % n),
        title: round === 0 ? b.title : `${b.title} (Variante ${round + 1})`,
        occasion: b.occasion,
        date: ctx.day(b.in + round * 7),
        priceCents: b.price + round * 100,
        ...(i % 3 === 0 ? { url: `https://shop.example.org/geschenk-${i}` } : {}),
        status: round === 0 ? b.status : i % 5 === 0 ? 'bought' : 'idea',
        ...(b.note ? { note: b.note } : {}),
      },
    };
  });
  return { person, gift };
}

export default { seed } satisfies SeedModule;
