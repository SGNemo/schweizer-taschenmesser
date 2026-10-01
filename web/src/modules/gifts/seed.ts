import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

type Status = 'idea' | 'bought' | 'given';

const BASE: {
  title: string;
  forWhom: string;
  occasion: string;
  in: number;
  price: number;
  status: Status;
  note?: string;
}[] = [
  {
    title: 'Kochbuch "Italien einfach"',
    forWhom: 'Marta Lindqvist',
    occasion: 'Geburtstag',
    in: 9,
    price: 2490,
    status: 'idea',
  },
  {
    title: 'Wanderrucksack 28 l',
    forWhom: 'Jonas Brandt',
    occasion: 'Geburtstag',
    in: 21,
    price: 8900,
    status: 'bought',
    note: 'Versteckt im Schrank',
  },
  {
    title: 'Gutschein Töpferkurs',
    forWhom: 'Elke Sommer',
    occasion: 'Jubiläum',
    in: 34,
    price: 6500,
    status: 'idea',
  },
  {
    title: 'Gesellschaftsspiel für vier',
    forWhom: 'Familie Aydin',
    occasion: 'Einweihung',
    in: 4,
    price: 3290,
    status: 'bought',
  },
  {
    title: 'Handgemachte Kerzen',
    forWhom: 'Tante Greta',
    occasion: 'Weihnachten',
    in: 84,
    price: 1800,
    status: 'idea',
  },
  {
    title: 'Fotokalender mit Familienbildern',
    forWhom: 'Oma Hilde',
    occasion: 'Weihnachten',
    in: 84,
    price: 2200,
    status: 'idea',
  },
  {
    title: 'Bluetooth-Lautsprecher',
    forWhom: 'Tobias Reuter',
    occasion: 'Geburtstag',
    in: -12,
    price: 4900,
    status: 'given',
  },
  {
    title: 'Blumenstrauß und Karte',
    forWhom: 'Nachbarin Frau Albers',
    occasion: 'Dankeschön',
    in: 2,
    price: 1500,
    status: 'idea',
  },
  {
    title: 'Tee-Set mit Kanne',
    forWhom: 'Lea Hartmann',
    occasion: 'Abschied',
    in: 15,
    price: 3400,
    status: 'idea',
  },
  {
    title: 'Taschenlampe mit Dynamo',
    forWhom: 'Neffe Finn',
    occasion: 'Geburtstag',
    in: 47,
    price: 1990,
    status: 'idea',
  },
  {
    title: 'Schal aus Merinowolle',
    forWhom: 'Papa',
    occasion: 'Weihnachten',
    in: 84,
    price: 4500,
    status: 'bought',
  },
  {
    title: 'Konzertkarten',
    forWhom: 'Svenja Koch',
    occasion: 'Geburtstag',
    in: -30,
    price: 7800,
    status: 'given',
  },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 12, large: 90 });
  return {
    idea: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('gifts', 'idea', i),
        data: {
          title: round === 0 ? b.title : `${b.title} (Variante ${round + 1})`,
          forWhom: b.forWhom,
          occasion: b.occasion,
          date: ctx.day(b.in + round * 7),
          priceCents: b.price + round * 100,
          ...(i % 3 === 0 ? { url: `https://shop.example.org/geschenk-${i}` } : {}),
          status: round === 0 ? b.status : i % 5 === 0 ? 'bought' : 'idea',
          ...(b.note ? { note: b.note } : {}),
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
