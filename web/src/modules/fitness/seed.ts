import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data: a few training sessions this and last week (strength + running) and plain meals for
 * today and the last days. Harmless and invented: no body data, no goal set.
 * Pure and deterministic; dates relative to `ctx.today`.
 */
const tx = (de: string, en: string) => ({ de, en });

const SESSIONS = [
  {
    title: tx('Oberkörper', 'Upper body'),
    durationMin: 55,
    exercises: [
      { name: tx('Bankdrücken', 'Bench press'), sets: 3, reps: 8, weightKg: 60 },
      { name: tx('Rudern', 'Row'), sets: 3, reps: 10, weightKg: 45 },
      { name: tx('Schulterdrücken', 'Shoulder press'), sets: 3, reps: 10, weightKg: 22.5 },
    ],
  },
  {
    title: tx('Laufen', 'Running'),
    durationMin: 35,
    exercises: [{ name: tx('Laufen', 'Running'), durationMin: 35 }],
  },
  {
    title: tx('Beine', 'Legs'),
    durationMin: 50,
    exercises: [
      { name: tx('Kniebeuge', 'Squat'), sets: 4, reps: 6, weightKg: 70 },
      { name: tx('Kreuzheben', 'Deadlift'), sets: 3, reps: 5, weightKg: 80 },
      { name: tx('Plank', 'Plank'), sets: 3, durationMin: 3 },
    ],
  },
];

const MEALS = [
  { text: tx('Haferflocken mit Obst', 'Oats with fruit'), kcal: 350, time: '07:30' },
  { text: tx('Brot mit Käse', 'Bread with cheese'), kcal: 420, time: '12:15' },
  { text: tx('Apfel', 'Apple'), kcal: 80, time: '15:00' },
  { text: tx('Nudeln mit Tomatensoße', 'Pasta with tomato sauce'), kcal: 650, time: '19:00' },
  { text: tx('Joghurt', 'Yoghurt'), kcal: 150, time: '21:00' },
];

function seed(ctx: SeedContext): SeedRows {
  const days = ctx.count({ small: 7, medium: 21, large: 120 });
  const session = [];
  // Every second or third day a session, the newest yesterday (today stays open for the e2e).
  for (let d = 1, i = 0; d <= days; d += ctx.rng.int(2, 3), i++) {
    const def = SESSIONS[i % SESSIONS.length]!;
    session.push({
      id: ctx.id('fitness', 'session', i),
      data: {
        date: ctx.day(-d),
        time: '18:00',
        title: ctx.text(def.title),
        durationMin: def.durationMin,
        exercises: def.exercises.map(({ name, ...rest }) => ({ name: ctx.text(name), ...rest })),
      },
    });
  }
  const meal = [];
  for (let d = 0, i = 0; d < Math.min(days, 14); d++) {
    // Today: breakfast and lunch only, so the day sum is not complete yet.
    const list = d === 0 ? MEALS.slice(0, 2) : MEALS.filter(() => ctx.rng.chance(0.8));
    for (const m of list)
      meal.push({
        id: ctx.id('fitness', 'meal', i++),
        data: { date: ctx.day(-d), time: m.time, text: ctx.text(m.text), kcal: m.kcal },
      });
  }
  return { session, meal };
}

export default { seed } satisfies SeedModule;
