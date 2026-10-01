import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

type Place = 'fridge' | 'freezer' | 'pantry' | 'other';

// exp: days from today until best-before (undefined = none); min: restock threshold
const BASE: {
  name: string;
  place: Place;
  count: number;
  min?: number;
  exp?: number;
  note?: string;
}[] = [
  { name: 'Vollmilch 1 l', place: 'fridge', count: 2, min: 1, exp: 2 },
  { name: 'Joghurt natur', place: 'fridge', count: 3, min: 2, exp: -1 },
  { name: 'Butter', place: 'fridge', count: 1, min: 1, exp: 18 },
  { name: 'Eier (10er)', place: 'fridge', count: 1, min: 1, exp: 12 },
  { name: 'Tiefkühlspinat', place: 'freezer', count: 4, min: 2, exp: 160 },
  { name: 'Fischstäbchen', place: 'freezer', count: 1, min: 1, exp: 90 },
  { name: 'Spaghetti 500 g', place: 'pantry', count: 5, min: 2 },
  { name: 'Passierte Tomaten', place: 'pantry', count: 1, min: 2, exp: 200 },
  { name: 'Haferflocken', place: 'pantry', count: 2, min: 1, exp: 3 },
  { name: 'Olivenöl', place: 'pantry', count: 1, min: 1, exp: 250 },
  { name: 'Kaffeebohnen', place: 'pantry', count: 0, min: 1, note: 'Nachkaufen' },
  { name: 'Küchenrollen', place: 'other', count: 6, min: 2 },
  { name: 'Frischkäse', place: 'fridge', count: 1, exp: 1 },
  { name: 'Linsen rot', place: 'pantry', count: 3, exp: 300 },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 8, medium: 14, large: 120 });
  return {
    item: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('pantry', 'item', i),
        data: {
          name: round === 0 ? b.name : `${b.name} (${round + 1})`,
          place: b.place,
          count: b.count,
          ...(b.min !== undefined ? { minCount: b.min } : {}),
          ...(b.exp !== undefined ? { expires: ctx.day(b.exp + round * 5) } : {}),
          ...(b.note ? { note: b.note } : {}),
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
