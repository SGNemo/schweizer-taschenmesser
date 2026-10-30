import type { Lang } from '@/core/i18n/lang';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

type Packing = { name: string; items: string[] };
interface Texts {
  shopping: string[];
  shoppingList: string;
  packing: Packing[];
  checklist: string[];
  checklistName: string;
}

const TEXTS: Record<Lang, Texts> = {
  de: {
    shopping: [
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
    ],
    shoppingList: 'Einkauf',
    packing: [
      {
        name: 'Wochenendtrip',
        items: [
          'Zahnbürste',
          'Ladekabel',
          'Regenjacke',
          'Wechselkleidung',
          'Bahnticket',
          'Kopfhörer',
        ],
      },
      {
        name: 'Camping',
        items: ['Zelt', 'Schlafsack', 'Isomatte', 'Campingkocher', 'Stirnlampe', 'Mückenschutz'],
      },
    ],
    checklist: ['Müll rausbringen', 'Pflanzen gießen', 'Rechnungen prüfen', 'Fahrrad aufpumpen'],
    checklistName: 'Wochenaufgaben',
  },
  en: {
    shopping: [
      '2 Milk',
      'Bread',
      '500 g Flour',
      'Eggs',
      'Butter',
      'Apples',
      'Pasta',
      'Tomatoes',
      'Cheese',
      'Coffee',
      'Yoghurt',
      'Onions',
      'Rice',
      'Bananas',
    ],
    shoppingList: 'Shopping',
    packing: [
      {
        name: 'Weekend trip',
        items: [
          'Toothbrush',
          'Charging cable',
          'Rain jacket',
          'Spare clothes',
          'Train ticket',
          'Headphones',
        ],
      },
      {
        name: 'Camping',
        items: [
          'Tent',
          'Sleeping bag',
          'Sleeping mat',
          'Camping stove',
          'Headlamp',
          'Mosquito repellent',
        ],
      },
    ],
    checklist: ['Take out the rubbish', 'Water the plants', 'Check the bills', 'Pump up the bike'],
    checklistName: 'Weekly tasks',
  },
  es: {
    shopping: [
      '2 Leche',
      'Pan',
      '500 g Harina',
      'Huevos',
      'Mantequilla',
      'Manzanas',
      'Pasta',
      'Tomates',
      'Queso',
      'Café',
      'Yogur',
      'Cebollas',
      'Arroz',
      'Plátanos',
    ],
    shoppingList: 'Compra',
    packing: [
      {
        name: 'Escapada de fin de semana',
        items: [
          'Cepillo de dientes',
          'Cable de carga',
          'Chubasquero',
          'Ropa de recambio',
          'Billete de tren',
          'Auriculares',
        ],
      },
      {
        name: 'Camping',
        items: [
          'Tienda de campaña',
          'Saco de dormir',
          'Esterilla',
          'Hornillo',
          'Linterna frontal',
          'Repelente de mosquitos',
        ],
      },
    ],
    checklist: ['Sacar la basura', 'Regar las plantas', 'Revisar las facturas', 'Inflar la bici'],
    checklistName: 'Tareas semanales',
  },
  fr: {
    shopping: [
      '2 Lait',
      'Pain',
      '500 g Farine',
      'Œufs',
      'Beurre',
      'Pommes',
      'Pâtes',
      'Tomates',
      'Fromage',
      'Café',
      'Yaourt',
      'Oignons',
      'Riz',
      'Bananes',
    ],
    shoppingList: 'Courses',
    packing: [
      {
        name: 'Week-end',
        items: [
          'Brosse à dents',
          'Câble de charge',
          'Imperméable',
          'Vêtements de rechange',
          'Billet de train',
          'Écouteurs',
        ],
      },
      {
        name: 'Camping',
        items: [
          'Tente',
          'Sac de couchage',
          'Tapis de sol',
          'Réchaud',
          'Lampe frontale',
          'Anti-moustiques',
        ],
      },
    ],
    checklist: [
      'Sortir les poubelles',
      'Arroser les plantes',
      'Vérifier les factures',
      'Gonfler le vélo',
    ],
    checklistName: 'Tâches de la semaine',
  },
  'pt-BR': {
    shopping: [
      '2 Leite',
      'Pão',
      '500 g Farinha',
      'Ovos',
      'Manteiga',
      'Maçãs',
      'Macarrão',
      'Tomates',
      'Queijo',
      'Café',
      'Iogurte',
      'Cebolas',
      'Arroz',
      'Bananas',
    ],
    shoppingList: 'Compras',
    packing: [
      {
        name: 'Fim de semana fora',
        items: [
          'Escova de dentes',
          'Cabo de carregador',
          'Capa de chuva',
          'Roupa extra',
          'Passagem de trem',
          'Fones de ouvido',
        ],
      },
      {
        name: 'Camping',
        items: [
          'Barraca',
          'Saco de dormir',
          'Isolante térmico',
          'Fogareiro',
          'Lanterna de cabeça',
          'Repelente',
        ],
      },
    ],
    checklist: [
      'Levar o lixo para fora',
      'Regar as plantas',
      'Conferir as contas',
      'Encher o pneu da bike',
    ],
    checklistName: 'Tarefas da semana',
  },
};

/** Names with a leading number become quantity + name, like the real parser does it. */
function parse(text: string): { name: string; quantity?: string } {
  const m = text.match(/^(\d+(?:\s?g)?)\s+(.+)$/);
  return m ? { name: m[2]!, quantity: m[1]! } : { name: text };
}

function seed(ctx: SeedContext): SeedRows {
  const SHOPPING = TEXTS[ctx.lang].shopping;
  const PACKING = TEXTS[ctx.lang].packing;
  const CHECKLIST = TEXTS[ctx.lang].checklist;
  const shopping = ctx.count({ small: 6, medium: 14, large: 200 });
  const listRows: SeedRow[] = [
    {
      id: 'shopping-default',
      data: { name: TEXTS[ctx.lang].shoppingList, kind: 'shopping', order: 0 },
    },
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
    data: { name: TEXTS[ctx.lang].checklistName, kind: 'checklist', order: 10 },
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
