import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

const SHOPPING = [
  '2 Milch',
  'Brot',
  '500 g Mehl',
  'Eier',
  'Butter',
  'Äpfel',
  'Nudeln',
  'Tomaten',
  'Käse',
  'Kaffee',
  'Joghurt',
  'Zwiebeln',
  'Reis',
  'Bananen',
];
const PACKING: { name: string; items: string[] }[] = [
  {
    name: 'Wochenendtrip',
    items: ['Zahnbürste', 'Ladekabel', 'Regenjacke', 'Wechselkleidung', 'Bahnticket', 'Kopfhörer'],
  },
  {
    name: 'Camping',
    items: ['Zelt', 'Schlafsack', 'Isomatte', 'Campingkocher', 'Stirnlampe', 'Mückenschutz'],
  },
];
const CHECKLIST = ['Müll rausbringen', 'Pflanzen gießen', 'Rechnungen prüfen', 'Fahrrad aufpumpen'];

/** Names with a leading number become quantity + name, like the real parser does it. */
function parse(text: string): { name: string; quantity?: string } {
  const m = text.match(/^(\d+(?:\s?g)?)\s+(.+)$/);
  return m ? { name: m[2]!, quantity: m[1]! } : { name: text };
}

function seed(ctx: SeedContext): SeedRows {
  const shopping = ctx.count({ small: 6, medium: 14, large: 200 });
  const listRows: SeedRow[] = [
    { id: 'shopping-default', data: { name: 'Einkauf', kind: 'shopping', order: 0 } },
  ];
  const itemRows: SeedRow[] = [];
  for (let i = 0; i < shopping; i++) {
    const { name, quantity } = parse(
      i < SHOPPING.length ? SHOPPING[i]! : `${ctx.rng.pick(SHOPPING)} ${i + 1}`,
    );
    itemRows.push({
      id: ctx.id('lists', 'item', `shop-${i}`),
      data: {
        listId: 'shopping-default',
        name,
        ...(quantity ? { quantity } : {}),
        done: i % 3 === 2,
        order: i,
      },
    });
  }
  const packing = ctx.count({ small: 1, medium: 2, large: 2 });
  for (let l = 0; l < packing; l++) {
    const src = PACKING[l]!;
    const listId = ctx.id('lists', 'list', `pack-${l}`);
    listRows.push({ id: listId, data: { name: src.name, kind: 'packing', order: l + 1 } });
    src.items.forEach((name, idx) =>
      itemRows.push({
        id: ctx.id('lists', 'item', `pack-${l}-${idx}`),
        data: { listId, name, done: idx < 2, order: idx },
      }),
    );
  }
  const checklistId = ctx.id('lists', 'list', 'check-0');
  listRows.push({
    id: checklistId,
    data: { name: 'Wochenaufgaben', kind: 'checklist', order: 10 },
  });
  CHECKLIST.forEach((name, idx) =>
    itemRows.push({
      id: ctx.id('lists', 'item', `check-${idx}`),
      data: { listId: checklistId, name, done: idx === 0, order: idx },
    }),
  );
  return { list: listRows, item: itemRows };
}

export default { seed } satisfies SeedModule;
