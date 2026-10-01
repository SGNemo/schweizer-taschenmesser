import { isoWeekday } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';

const ALL = [1, 2, 3, 4, 5, 6, 7];
const HABITS = [
  { name: 'Wasser trinken (2 Liter)', weekdays: ALL, rate: 0.9, streak: 12 },
  { name: 'Spazieren gehen', weekdays: ALL, rate: 0.7, streak: 4 },
  { name: 'Lesen (20 Minuten)', weekdays: ALL, rate: 0.6, streak: 0 },
  { name: 'Sport', weekdays: [1, 3, 5], rate: 0.8, streak: 6 },
  { name: 'Wohnung aufräumen', weekdays: [6, 7], rate: 0.75, streak: 0 },
  { name: 'Spanisch lernen', weekdays: [1, 2, 3, 4, 5], rate: 0.5, streak: 0 },
];
const EXTRA = ['Meditation', 'Dehnen', 'Tagebuch', 'Kein Zucker', 'Gitarre üben'];

function seed(ctx: SeedContext): SeedRows {
  const nHabits = ctx.count({ small: 4, medium: 6, large: 30 });
  const days = ctx.count({ small: 21, medium: 28, large: 180 });
  const habits = Array.from({ length: nHabits }, (_, i) =>
    i < HABITS.length
      ? HABITS[i]!
      : {
          name: `${ctx.rng.pick(EXTRA)} ${i}`,
          weekdays: ctx.rng.chance(0.5) ? ALL : [1, 2, 3, 4, 5],
          rate: 0.4 + ctx.rng.next() * 0.5,
          streak: 0,
        },
  );
  const habitRows: SeedRow[] = habits.map((h, i) => ({
    id: ctx.id('habits', 'habit', i),
    data: { name: h.name, weekdays: h.weekdays, archived: false },
  }));
  const checks: SeedRow[] = [];
  habits.forEach((h, i) => {
    const habitId = habitRows[i]!.id;
    for (let back = 0; back < days; back++) {
      const date = ctx.day(-back);
      if (!h.weekdays.includes(isoWeekday(date))) continue;
      // The current streak: every due day counted back from yesterday is checked (today stays open
      // for the first habits so the widget shows open entries); beyond it the rate decides.
      const inStreak = h.streak > 0 && back <= h.streak;
      const checked =
        back === 0 ? i % 2 === 1 : inStreak || (back > h.streak && ctx.rng.chance(h.rate));
      // A gap right after the streak keeps it realistic.
      if (h.streak > 0 && back === h.streak + 1) continue;
      if (checked) checks.push({ id: `${habitId}:${date}`, data: { habitId, date } });
    }
  });
  return { habit: habitRows, check: checks };
}

export default { seed } satisfies SeedModule;
