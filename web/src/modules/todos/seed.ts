import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

const LISTS = [
  { name: 'Haushalt', color: '#2f7fb8' },
  { name: 'Arbeit', color: '#d9822b' },
  { name: 'Einkäufe & Besorgungen', color: '#3f9a6a' },
  { name: 'Projekt Balkon', color: '#8a5cc2' },
];

interface Base {
  list: number;
  title: string;
  due?: number;
  priority: number;
  done?: boolean;
  note?: string;
  subs?: { title: string; done?: boolean }[];
}

const BASE: Base[] = [
  {
    list: 0,
    title: 'Steuererklärung vorbereiten',
    due: 0,
    priority: 3,
    subs: [
      { title: 'Belege sortieren', done: true },
      { title: 'Formular ausfüllen' },
      { title: 'Abgeben' },
    ],
  },
  { list: 0, title: 'Fenster putzen', due: -2, priority: 1 },
  { list: 0, title: 'Glühbirne im Flur wechseln', due: 3, priority: 0 },
  { list: 0, title: 'Keller aufräumen', priority: 1, note: 'Altes Regal entsorgen' },
  { list: 0, title: 'Waschmaschine entkalken', priority: 0, done: true, due: -6 },
  {
    list: 1,
    title: 'Quartalsbericht schreiben',
    due: 2,
    priority: 3,
    subs: [{ title: 'Zahlen einholen', done: true }, { title: 'Entwurf an Team' }],
  },
  { list: 1, title: 'Urlaubsantrag einreichen', due: 0, priority: 2 },
  { list: 1, title: 'Präsentation proben', due: 4, priority: 2 },
  { list: 1, title: 'Reisekosten abrechnen', due: -4, priority: 2 },
  { list: 1, title: 'Wochenplanung', priority: 0, done: true, due: -1 },
  { list: 2, title: 'Geschenk für Oma besorgen', due: 2, priority: 2 },
  { list: 2, title: 'Zahnbürsten kaufen', priority: 0 },
  { list: 2, title: 'Paket zur Post bringen', due: 1, priority: 1, done: true },
  {
    list: 3,
    title: 'Balkonmöbel streichen',
    due: 6,
    priority: 1,
    subs: [{ title: 'Farbe kaufen' }, { title: 'Schleifen' }],
  },
  { list: 3, title: 'Kräutersamen bestellen', priority: 0, done: true },
];
const TITLES = [
  'Rechnung bezahlen',
  'Mail beantworten',
  'Termin vereinbaren',
  'Bücher aussortieren',
  'Auto waschen',
  'Ordner abheften',
  'Recherche',
  'Formular ausfüllen',
  'Vorräte prüfen',
  'Fahrradreifen aufpumpen',
];

function seed(ctx: SeedContext): SeedRows {
  const nLists = ctx.count({ small: 3, medium: 4, large: 4 });
  const extra = ctx.count({ small: 0, medium: 25, large: 300 });
  const lists: SeedRow[] = LISTS.slice(0, nLists).map((l, i) => ({
    id: ctx.id('todos', 'list', i),
    data: { name: l.name, color: l.color, order: i },
  }));
  const base = ctx.scale === 'small' ? BASE.filter((b) => b.list < nLists) : BASE;
  const all: Base[] = [...base];
  for (let i = 0; i < extra; i++) {
    const done = ctx.rng.chance(0.4);
    all.push({
      list: ctx.rng.int(0, nLists - 1),
      title: `${ctx.rng.pick(TITLES)} ${i + 1}`,
      due: ctx.rng.chance(0.6) ? ctx.rng.int(-10, 21) : undefined,
      priority: ctx.rng.int(0, 3),
      done,
      subs: ctx.rng.chance(0.15)
        ? [
            { title: 'Schritt 1', done },
            { title: 'Schritt 2', done: false },
          ]
        : undefined,
    });
  }
  const tasks: SeedRow[] = [];
  const orderByList = new Map<number, number>();
  all.forEach((b, i) => {
    const order = (orderByList.get(b.list) ?? 0) + 1;
    orderByList.set(b.list, order);
    const id = ctx.id('todos', 'task', i);
    const listId = lists[b.list]!.id;
    const done = b.done ?? false;
    const data: Record<string, unknown> = {
      listId,
      title: b.title,
      done,
      priority: b.priority,
      order,
    };
    if (b.due !== undefined) data.dueDate = ctx.day(b.due);
    if (b.note) data.note = b.note;
    if (done) data.completedAt = ctx.at(Math.min(b.due ?? -1, -1), '18:00');
    tasks.push({ id, data });
    (b.subs ?? []).forEach((s, j) => {
      const sd = s.done ?? false;
      const sub: Record<string, unknown> = {
        listId,
        title: s.title,
        done: sd,
        priority: 0,
        parentId: id,
        order: j + 1,
      };
      if (sd) sub.completedAt = ctx.at(-1, '17:00');
      tasks.push({ id: ctx.id('todos', 'task', `${i}-${j}`), data: sub });
    });
  });
  return { list: lists, task: tasks };
}

export default { seed } satisfies SeedModule;
