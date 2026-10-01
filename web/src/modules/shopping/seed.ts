import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const BASE: { name: string; quantity?: string }[] = [
  { name: 'Bananen', quantity: '6' },
  { name: 'Vollkornbrot', quantity: '1' },
  { name: 'Hafermilch', quantity: '2 Packungen' },
  { name: 'Tomaten', quantity: '500 g' },
  { name: 'Spülmittel' },
  { name: 'Basilikum', quantity: '1 Topf' },
  { name: 'Käse am Stück', quantity: '300 g' },
  { name: 'Zahnpasta' },
  { name: 'Nudeln', quantity: '2 Packungen' },
  { name: 'Äpfel', quantity: '1 kg' },
  { name: 'Müllbeutel', quantity: '1 Rolle' },
  { name: 'Blumenkohl', quantity: '1' },
  { name: 'Kaffee', quantity: '500 g' },
  { name: 'Eier', quantity: '10' },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 24, large: 200 });
  return {
    item: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('shopping', 'item', i),
        data: {
          name: round === 0 ? b.name : `${b.name} (${round + 1})`,
          ...(b.quantity ? { quantity: b.quantity } : {}),
          done: i % 3 === 2,
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
