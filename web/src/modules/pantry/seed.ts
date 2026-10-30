import type { Lang } from '@/core/i18n/lang';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

type Place = 'fridge' | 'freezer' | 'pantry' | 'other';

/** Source text and its four translations (en, es, fr, pt-BR); picked per language in `seed`. */
const L = (de: string, en: string, es: string, fr: string, pt: string) => ({
  de,
  en,
  es,
  fr,
  'pt-BR': pt,
});

// exp: days from today until best-before (undefined = none); min: restock threshold
const BASE: {
  name: Record<Lang, string>;
  place: Place;
  count: number;
  min?: number;
  exp?: number;
  note?: Record<Lang, string>;
}[] = [
  {
    name: L(
      'Vollmilch 1 l',
      'Whole milk 1 l',
      'Leche entera 1 l',
      'Lait entier 1 l',
      'Leite integral 1 l',
    ),
    place: 'fridge',
    count: 2,
    min: 1,
    exp: 2,
  },
  {
    name: L('Joghurt natur', 'Plain yoghurt', 'Yogur natural', 'Yaourt nature', 'Iogurte natural'),
    place: 'fridge',
    count: 3,
    min: 2,
    exp: -1,
  },
  {
    name: L('Butter', 'Butter', 'Mantequilla', 'Beurre', 'Manteiga'),
    place: 'fridge',
    count: 1,
    min: 1,
    exp: 18,
  },
  {
    name: L('Eier (10er)', 'Eggs (10)', 'Huevos (10)', 'Œufs (10)', 'Ovos (10)'),
    place: 'fridge',
    count: 1,
    min: 1,
    exp: 12,
  },
  {
    name: L(
      'Tiefkühlspinat',
      'Frozen spinach',
      'Espinacas congeladas',
      'Épinards surgelés',
      'Espinafre congelado',
    ),
    place: 'freezer',
    count: 4,
    min: 2,
    exp: 160,
  },
  {
    name: L(
      'Fischstäbchen',
      'Fish fingers',
      'Palitos de pescado',
      'Bâtonnets de poisson',
      'Bastões de peixe',
    ),
    place: 'freezer',
    count: 1,
    min: 1,
    exp: 90,
  },
  {
    name: L(
      'Spaghetti 500 g',
      'Spaghetti 500 g',
      'Espaguetis 500 g',
      'Spaghetti 500 g',
      'Espaguete 500 g',
    ),
    place: 'pantry',
    count: 5,
    min: 2,
  },
  {
    name: L(
      'Passierte Tomaten',
      'Passata',
      'Tomate triturado',
      'Coulis de tomates',
      'Molho de tomate',
    ),
    place: 'pantry',
    count: 1,
    min: 2,
    exp: 200,
  },
  {
    name: L('Haferflocken', 'Rolled oats', 'Copos de avena', 'Flocons d’avoine', 'Flocos de aveia'),
    place: 'pantry',
    count: 2,
    min: 1,
    exp: 3,
  },
  {
    name: L('Olivenöl', 'Olive oil', 'Aceite de oliva', 'Huile d’olive', 'Azeite de oliva'),
    place: 'pantry',
    count: 1,
    min: 1,
    exp: 250,
  },
  {
    name: L('Kaffeebohnen', 'Coffee beans', 'Café en grano', 'Café en grains', 'Café em grãos'),
    place: 'pantry',
    count: 0,
    min: 1,
    note: L('Nachkaufen', 'Buy more', 'Comprar más', 'À racheter', 'Comprar mais'),
  },
  {
    name: L(
      'Küchenrollen',
      'Kitchen rolls',
      'Rollos de cocina',
      'Rouleaux d’essuie-tout',
      'Rolos de papel-toalha',
    ),
    place: 'other',
    count: 6,
    min: 2,
  },
  {
    name: L('Frischkäse', 'Cream cheese', 'Queso crema', 'Fromage frais', 'Cream cheese'),
    place: 'fridge',
    count: 1,
    exp: 1,
  },
  {
    name: L(
      'Linsen rot',
      'Red lentils',
      'Lentejas rojas',
      'Lentilles corail',
      'Lentilhas vermelhas',
    ),
    place: 'pantry',
    count: 3,
    exp: 300,
  },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 8, medium: 14, large: 120 });
  return {
    item: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const name = b.name[ctx.lang];
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('pantry', 'item', i),
        data: {
          name: round === 0 ? name : `${name} (${round + 1})`,
          place: b.place,
          count: b.count,
          ...(b.min !== undefined ? { minCount: b.min } : {}),
          ...(b.exp !== undefined ? { expires: ctx.day(b.exp + round * 5) } : {}),
          ...(b.note ? { note: b.note[ctx.lang] } : {}),
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
