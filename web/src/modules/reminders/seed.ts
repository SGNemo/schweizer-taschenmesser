import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

interface Base {
  title: string;
  day: number;
  time: string;
  note?: string;
  recurrence?: Record<string, unknown>;
  active?: boolean;
}

const BASE: Base[] = [
  {
    title: 'Medikament nehmen',
    day: -10,
    time: '08:00',
    recurrence: { freq: 'daily', interval: 1 },
  },
  { title: 'Paket abholen', day: 0, time: '17:30', note: 'Abholschein liegt im Flur' },
  { title: 'Anna zurückrufen', day: 1, time: '12:15' },
  {
    title: 'Pflanzen gießen',
    day: -14,
    time: '19:00',
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [3, 7] },
  },
  {
    title: 'Zählerstand ablesen',
    day: -3,
    time: '09:00',
    recurrence: { freq: 'monthly', interval: 1, byMonthDay: 1 },
  },
  { title: 'Rechnung Stadtwerke prüfen', day: 3, time: '10:00' },
  { title: 'Reifenwechsel buchen', day: 6, time: '09:30', note: 'Werkstatt Rotbuche anrufen' },
  { title: 'Altes Abo kündigen', day: -20, time: '09:00', active: false },
];
const FILLER = [
  'Wäsche aufhängen',
  'Müll rausbringen',
  'Geschenk besorgen',
  'Termin bestätigen',
  'Mama anrufen',
  'Bücher zurückgeben',
  'Auto tanken',
  'Backup prüfen',
  'Blumen kaufen',
  'Putzplan checken',
];
const TIMES = ['07:30', '09:00', '12:00', '14:30', '18:00', '20:00'];

function seed(ctx: SeedContext): SeedRows {
  const total = ctx.count({ small: 6, medium: 24, large: 250 });
  const list: Base[] = BASE.slice(0, Math.min(total, BASE.length));
  if (ctx.scale === 'small') list[5] = BASE[7]!;
  for (let i = list.length; i < total; i++) {
    const recurring = ctx.rng.chance(0.3);
    list.push({
      title: ctx.rng.pick(FILLER),
      day: recurring ? ctx.rng.int(-30, 0) : ctx.rng.int(-5, 30),
      time: ctx.rng.pick(TIMES),
      recurrence: recurring
        ? ctx.rng.pick([
            { freq: 'daily', interval: 1 },
            { freq: 'weekly', interval: 1 },
            { freq: 'monthly', interval: 1 },
          ])
        : undefined,
      active: ctx.rng.chance(0.9),
    });
  }
  return {
    reminder: list.map((b, i) => {
      const data: Record<string, unknown> = {
        title: b.title,
        startDate: ctx.day(b.day),
        time: b.time,
        active: b.active ?? true,
      };
      if (b.note) data.note = b.note;
      if (b.recurrence) data.recurrence = b.recurrence;
      return { id: ctx.id('reminders', 'reminder', i), data };
    }),
  };
}

export default { seed } satisfies SeedModule;
