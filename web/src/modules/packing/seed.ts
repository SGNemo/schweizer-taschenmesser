import type { SeedContext, SeedModule, SeedRows, SeedRow } from '@/core/seed/types';

const LISTS: { name: string; note?: string; items: string[] }[] = [
  {
    name: 'Wochenendtrip',
    note: 'Zwei Nächte, Zug und Handgepäck',
    items: [
      'Zahnbürste',
      'Ladekabel',
      'Regenjacke',
      'Wechselkleidung',
      'Bahnticket',
      'Kopfhörer',
      'Sonnenbrille',
      'Buch',
    ],
  },
  {
    name: 'Camping',
    note: 'Drei Tage am See',
    items: [
      'Zelt',
      'Schlafsack',
      'Isomatte',
      'Campingkocher',
      'Stirnlampe',
      'Mückenschutz',
      'Wasserkanister',
      'Taschenmesser',
      'Müllbeutel',
      'Sonnencreme',
    ],
  },
  {
    name: 'Skiwochenende',
    items: ['Skijacke', 'Handschuhe', 'Skibrille', 'Thermounterwäsche', 'Skipass', 'Lippenpflege'],
  },
  {
    name: 'Strandurlaub',
    items: ['Badesachen', 'Strandtuch', 'Flip-Flops', 'Sonnenhut', 'Reisepass', 'Reiseapotheke'],
  },
];

function seed(ctx: SeedContext): SeedRows {
  const lists = ctx.count({ small: 2, medium: 3, large: 4 });
  const listRows: SeedRow[] = [];
  const itemRows: SeedRow[] = [];
  for (let l = 0; l < lists; l++) {
    const src = LISTS[l]!;
    const listId = ctx.id('packing', 'list', l);
    listRows.push({
      id: listId,
      data: { name: src.name, ...(src.note ? { note: src.note } : {}) },
    });
    // Lists are partly packed: the first list almost done, the others barely started.
    const packedCount = l === 0 ? src.items.length - 2 : l === 1 ? 3 : 1;
    const reps = ctx.count({ small: 1, medium: 1, large: 3 });
    for (let r = 0; r < reps; r++) {
      src.items.forEach((name, i) => {
        const idx = r * src.items.length + i;
        itemRows.push({
          id: ctx.id('packing', 'item', `${l}-${idx}`),
          data: {
            listId,
            name: r === 0 ? name : `${name} (${r + 1})`,
            packed: r === 0 ? i < packedCount : false,
            order: idx,
          },
        });
      });
    }
  }
  return { list: listRows, item: itemRows };
}

export default { seed } satisfies SeedModule;
