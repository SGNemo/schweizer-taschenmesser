import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';
import { isoWeekday, addDaysStr } from '@/core/time/dates';

/**
 * Test data: four goals (water as a number with a reminder window, a weekday walk, stretching three
 * times a week, a morning pill with a time) and a history of days with a few rest days.
 * Pure and deterministic; dates relative to `ctx.today`.
 */
interface Def {
  name: { de: string; en: string; es: string; fr: string; 'pt-BR': string };
  unit?: { de: string; en: string; es: string; fr: string; 'pt-BR': string };
  data: Record<string, unknown>;
  /** Chance that a planned day was done. */
  hit: number;
}

const GOALS: Def[] = [
  {
    name: {
      de: 'Wasser trinken',
      en: 'Drink water',
      es: 'Beber agua',
      fr: 'Boire de l’eau',
      'pt-BR': 'Beber água',
    },
    unit: { de: 'Gläser', en: 'glasses', es: 'vasos', fr: 'verres', 'pt-BR': 'copos' },
    data: {
      kind: 'count',
      target: 8,
      period: 'day',
      reminder: { kind: 'window', from: '09:00', to: '19:00', everyMin: 120 },
    },
    hit: 0.6,
  },
  {
    name: {
      de: 'Spazieren gehen',
      en: 'Go for a walk',
      es: 'Salir a caminar',
      fr: 'Aller se promener',
      'pt-BR': 'Dar uma caminhada',
    },
    data: { kind: 'yesno', target: 1, period: 'day', weekdays: [1, 2, 3, 4, 5] },
    hit: 0.7,
  },
  {
    name: { de: 'Dehnen', en: 'Stretch', es: 'Estirar', fr: 'S’étirer', 'pt-BR': 'Alongar' },
    data: { kind: 'yesno', target: 1, period: 'week', weeklyTimes: 3 },
    hit: 0.45,
  },
  {
    name: {
      de: 'Medikament nehmen',
      en: 'Take medication',
      es: 'Tomar la medicación',
      fr: 'Prendre le médicament',
      'pt-BR': 'Tomar o remédio',
    },
    data: { kind: 'yesno', target: 1, period: 'day', reminder: { kind: 'time', time: '08:00' } },
    hit: 0.85,
  },
];

function seed(ctx: SeedContext): SeedRows {
  const days = ctx.count({ small: 14, medium: 120, large: 365 });
  const nGoals = ctx.count({ small: 2, medium: 4, large: 4 });
  const goals: SeedRow[] = GOALS.slice(0, nGoals).map((g, i) => ({
    id: ctx.id('habits', 'goal', i),
    data: {
      name: ctx.text(g.name),
      ...g.data,
      ...(g.unit ? { unit: ctx.text(g.unit) } : {}),
      order: i,
    },
  }));
  const entries: SeedRow[] = [];
  GOALS.slice(0, nGoals).forEach((g, i) => {
    const goalId = goals[i]!.id;
    const target = g.data.kind === 'count' ? (g.data.target as number) : 1;
    // Today stays open, so the rings are alive: the history ends yesterday.
    for (let back = 1; back <= days; back++) {
      const date = addDaysStr(ctx.today, -back);
      const planned = !g.data.weekdays || (g.data.weekdays as number[]).includes(isoWeekday(date));
      const rest = ctx.rng.chance(0.04);
      const hit = ctx.rng.chance(g.hit);
      const count = hit ? target : g.data.kind === 'count' ? ctx.rng.int(0, target - 1) : 0;
      if (rest && planned) {
        entries.push({ id: `${goalId}:${date}`, data: { goalId, date, count: 0, skipped: true } });
      } else if (count > 0 && (planned || hit)) {
        entries.push({ id: `${goalId}:${date}`, data: { goalId, date, count } });
      }
    }
    // Today: water half way, the walk done.
    if (i === 0) {
      const date = ctx.today;
      entries.push({ id: `${goalId}:${date}`, data: { goalId, date, count: 3 } });
    }
    if (i === 1 && isoWeekday(ctx.today) <= 5)
      entries.push({ id: `${goalId}:${ctx.today}`, data: { goalId, date: ctx.today, count: 1 } });
  });
  return { goal: goals, entry: entries };
}

export default { seed } satisfies SeedModule;
