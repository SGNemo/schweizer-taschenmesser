import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data (package 4, realistic): 4 / 8 / 13 weeks of training at 2–4 sessions a week – upper body, legs,
 * running, full body, now and then yoga – with weights that rise slowly every two weeks; varied meals for the
 * last 7 / 21 / 60 days (today only breakfast and lunch); three templates; two plans ahead. Invented and
 * harmless: no body data, no goal. Pure and deterministic; dates relative to `ctx.today`, no session today.
 */
type Tx = { de: string; en: string };
const tx = (de: string, en: string): Tx => ({ de, en });

/** The catalogue names used here, in both languages (the strings follow the UI language, seeds the seed's). */
const EX = {
  benchPress: tx('Bankdrücken', 'Bench press'),
  row: tx('Rudern', 'Row'),
  shoulderPress: tx('Schulterdrücken', 'Shoulder press'),
  latPulldown: tx('Latziehen', 'Lat pulldown'),
  bicepsCurl: tx('Bizepscurls', 'Biceps curl'),
  squat: tx('Kniebeuge', 'Squat'),
  romanianDeadlift: tx('Rumänisches Kreuzheben', 'Romanian deadlift'),
  lunge: tx('Ausfallschritte', 'Lunges'),
  calfRaise: tx('Wadenheben', 'Calf raise'),
  plank: tx('Plank', 'Plank'),
  deadlift: tx('Kreuzheben', 'Deadlift'),
  pushUp: tx('Liegestütze', 'Push-ups'),
  pullUp: tx('Klimmzüge', 'Pull-ups'),
  legRaise: tx('Beinheben', 'Leg raise'),
  run: tx('Laufen', 'Running'),
  yoga: tx('Yoga', 'Yoga'),
};
type Ex = keyof typeof EX;

interface Line {
  ex: Ex;
  sets?: number;
  reps?: number;
  /** Starting weight; rises by `step` every two weeks. */
  kg?: number;
  step?: number;
  min?: number;
}
interface Program {
  title: Tx;
  durationMin: number;
  lines: Line[];
}

const PROGRAMS: Program[] = [
  {
    title: tx('Oberkörper', 'Upper body'),
    durationMin: 55,
    lines: [
      { ex: 'benchPress', sets: 4, reps: 8, kg: 50, step: 2.5 },
      { ex: 'row', sets: 4, reps: 10, kg: 40, step: 2.5 },
      { ex: 'shoulderPress', sets: 3, reps: 10, kg: 22, step: 1 },
      { ex: 'latPulldown', sets: 3, reps: 10, kg: 45, step: 2.5 },
      { ex: 'bicepsCurl', sets: 3, reps: 12, kg: 10, step: 1 },
    ],
  },
  {
    title: tx('Beine', 'Legs'),
    durationMin: 50,
    lines: [
      { ex: 'squat', sets: 4, reps: 6, kg: 60, step: 2.5 },
      { ex: 'romanianDeadlift', sets: 3, reps: 8, kg: 50, step: 2.5 },
      { ex: 'lunge', sets: 3, reps: 10, kg: 16, step: 1 },
      { ex: 'calfRaise', sets: 3, reps: 15, kg: 40, step: 2.5 },
      { ex: 'plank', sets: 3, min: 3 },
    ],
  },
  { title: tx('Laufen', 'Running'), durationMin: 35, lines: [{ ex: 'run', min: 35 }] },
  {
    title: tx('Ganzkörper', 'Full body'),
    durationMin: 45,
    lines: [
      { ex: 'deadlift', sets: 3, reps: 5, kg: 80, step: 5 },
      { ex: 'pushUp', sets: 3, reps: 15 },
      { ex: 'pullUp', sets: 3, reps: 6 },
      { ex: 'legRaise', sets: 3, reps: 12 },
    ],
  },
  { title: tx('Yoga', 'Yoga'), durationMin: 30, lines: [{ ex: 'yoga', min: 30 }] },
];

const MEALS = {
  breakfast: [
    { t: tx('Haferflocken mit Obst', 'Oats with fruit'), kcal: 350, p: 11, c: 58, f: 7 },
    { t: tx('Müsli mit Joghurt', 'Muesli with yoghurt'), kcal: 420 },
    { t: tx('Brot mit Käse', 'Bread with cheese'), kcal: 380, p: 18, c: 40, f: 15 },
    { t: tx('Rührei mit Brot', 'Scrambled eggs with bread'), kcal: 450 },
  ],
  lunch: [
    { t: tx('Nudeln mit Tomatensoße', 'Pasta with tomato sauce'), kcal: 650, p: 20, c: 110, f: 12 },
    { t: tx('Salat mit Hähnchen', 'Salad with chicken'), kcal: 480, p: 38, c: 18, f: 24 },
    { t: tx('Linseneintopf', 'Lentil stew'), kcal: 520 },
    { t: tx('Kantine: Gemüsecurry mit Reis', 'Canteen: vegetable curry with rice'), kcal: 700 },
    { t: tx('Döner', 'Kebab'), kcal: 650 },
  ],
  dinner: [
    { t: tx('Brot mit Aufschnitt', 'Bread with cold cuts'), kcal: 520 },
    { t: tx('Ofengemüse mit Feta', 'Roast vegetables with feta'), kcal: 560, p: 18, c: 40, f: 34 },
    { t: tx('Lachs mit Kartoffeln', 'Salmon with potatoes'), kcal: 620, p: 36, c: 45, f: 30 },
    { t: tx('Pizza', 'Pizza'), kcal: 850 },
    { t: tx('Suppe und Brot', 'Soup and bread'), kcal: 430 },
  ],
  snack: [
    { t: tx('Apfel', 'Apple'), kcal: 80 },
    { t: tx('Joghurt', 'Yoghurt'), kcal: 150, p: 8, c: 12, f: 7 },
    { t: tx('Kaffee mit Milch', 'Coffee with milk'), kcal: 40 },
    { t: tx('Nüsse', 'Nuts'), kcal: 200 },
    { t: tx('Schokolade', 'Chocolate'), kcal: 160 },
  ],
};

function exercises(ctx: SeedContext, program: Program, weeksAgo: number) {
  // Two weeks per step: the older the session, the lighter the weight.
  const steps = Math.max(0, 6 - Math.floor(weeksAgo / 2));
  return program.lines.map((l) => ({
    name: ctx.text(EX[l.ex]),
    ...(l.sets ? { sets: l.sets } : {}),
    ...(l.reps ? { reps: l.reps } : {}),
    ...(l.kg ? { weightKg: Math.round((l.kg + steps * (l.step ?? 0)) * 10) / 10 } : {}),
    ...(l.min ? { durationMin: l.min } : {}),
  }));
}

function seed(ctx: SeedContext): SeedRows {
  const weeks = ctx.count({ small: 4, medium: 8, large: 13 });
  const session: { id: string; data: Record<string, unknown> }[] = [];
  let n = 0;
  for (let w = 0; w < weeks; w++) {
    // 2–4 sessions a week on spread-out days (1 = yesterday … 7 = a week ago), never today.
    const count = ctx.rng.int(2, 4);
    // The latest session is always yesterday (on the first day of a week that is last week's plate).
    const picked = ctx.rng.shuffle(w === 0 ? [2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]);
    const days = (w === 0 ? [1, ...picked.slice(0, count - 1)] : picked.slice(0, count)).sort(
      (a, b) => a - b,
    );
    for (const d of days) {
      const ago = w * 7 + d;
      const program = PROGRAMS[ctx.rng.chance(0.12) ? 4 : (n + w) % 4]!;
      session.push({
        id: ctx.id('fitness', 'session', n++),
        data: {
          date: ctx.day(-ago),
          time: ctx.rng.pick(['07:00', '12:30', '18:00', '18:30', '19:15']),
          title: ctx.text(program.title),
          durationMin: program.durationMin + ctx.rng.int(-5, 10),
          exercises: exercises(ctx, program, w),
        },
      });
    }
  }
  // Two plans ahead: legs tomorrow evening, a run in three days.
  session.push({
    id: ctx.id('fitness', 'session', 'planned'),
    data: {
      date: ctx.day(1),
      time: '18:00',
      title: ctx.text(PROGRAMS[1]!.title),
      durationMin: PROGRAMS[1]!.durationMin,
      exercises: exercises(ctx, PROGRAMS[1]!, 0),
      planned: true,
    },
  });
  session.push({
    id: ctx.id('fitness', 'session', 'planned-run'),
    data: {
      date: ctx.day(3),
      title: ctx.text(PROGRAMS[2]!.title),
      durationMin: 40,
      exercises: exercises(ctx, PROGRAMS[2]!, 0),
      planned: true,
    },
  });

  const meal: { id: string; data: Record<string, unknown> }[] = [];
  const mealDays = ctx.count({ small: 7, medium: 21, large: 60 });
  let m = 0;
  for (let d = 0; d < mealDays; d++) {
    const slots: [keyof typeof MEALS, string][] =
      d === 0
        ? [
            ['breakfast', '07:30'],
            ['lunch', '12:15'],
          ]
        : [
            ['breakfast', ctx.rng.pick(['06:45', '07:30', '08:15'])],
            ['lunch', ctx.rng.pick(['12:00', '12:30', '13:15'])],
            ...(ctx.rng.chance(0.7) ? [['snack', '15:30'] as [keyof typeof MEALS, string]] : []),
            ['dinner', ctx.rng.pick(['18:30', '19:00', '20:00'])],
            ...(ctx.rng.chance(0.3) ? [['snack', '21:00'] as [keyof typeof MEALS, string]] : []),
          ];
    for (const [slot, time] of slots) {
      const x = ctx.rng.pick(MEALS[slot]);
      meal.push({
        id: ctx.id('fitness', 'meal', m++),
        data: {
          date: ctx.day(-d),
          time,
          text: ctx.text(x.t),
          kcal: x.kcal,
          ...('p' in x ? { proteinG: x.p, carbsG: x.c, fatG: x.f } : {}),
        },
      });
    }
  }

  const template = [PROGRAMS[0]!, PROGRAMS[1]!, PROGRAMS[2]!].map((p, i) => ({
    id: ctx.id('fitness', 'template', i),
    data: { title: ctx.text(p.title), durationMin: p.durationMin, exercises: exercises(ctx, p, 0) },
  }));
  return { session, meal, template };
}

export default { seed } satisfies SeedModule;
