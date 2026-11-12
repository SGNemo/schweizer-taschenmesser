import type { Recurrence } from '@/core/recurrence/types';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';
import { firstDue } from './logic';

/**
 * Test data for the Dev-Preview, E2E tests and screenshots. Pure and deterministic: only `ctx`. A household with
 * two names: some routines are due today, most come round later; a few have no names or no room.
 * Bump `seed.version` in the manifest whenever the output changes.
 */
interface Def {
  name: string;
  room?: string;
  repeat: Recurrence;
  /** Days from today to the rule's first day (negative = it started in the past). */
  start: number;
  people?: string[];
  minutes?: number;
}

const weekly = (interval = 1): Recurrence => ({ freq: 'weekly', interval });
const monthly = (interval = 1): Recurrence => ({ freq: 'monthly', interval });

const DEFS: Def[] = [
  {
    name: 'Bad putzen',
    room: 'Bad',
    repeat: weekly(),
    start: -14,
    people: ['Mia', 'Ben'],
    minutes: 30,
  },
  {
    name: 'Staubsaugen',
    room: 'Wohnzimmer',
    repeat: weekly(),
    start: -7,
    people: ['Ben', 'Mia'],
    minutes: 20,
  },
  {
    name: 'Müll rausbringen',
    room: 'Küche',
    repeat: { freq: 'daily', interval: 2 },
    start: -4,
    people: ['Mia', 'Ben'],
    minutes: 5,
  },
  { name: 'Bettwäsche wechseln', room: 'Schlafzimmer', repeat: weekly(2), start: -9, minutes: 15 },
  {
    name: 'Kühlschrank auswischen',
    room: 'Küche',
    repeat: monthly(),
    start: -20,
    people: ['Ben', 'Mia'],
  },
  { name: 'Pflanzen gießen', repeat: { freq: 'daily', interval: 3 }, start: -2, minutes: 10 },
  {
    name: 'Fenster putzen',
    room: 'Wohnzimmer',
    repeat: monthly(3),
    start: -40,
    people: ['Mia', 'Ben'],
    minutes: 60,
  },
  { name: 'Handtücher waschen', room: 'Bad', repeat: weekly(), start: -3 },
  { name: 'Backofen reinigen', room: 'Küche', repeat: monthly(2), start: -12 },
  {
    name: 'Flur wischen',
    room: 'Flur',
    repeat: weekly(2),
    start: -6,
    people: ['Ben', 'Mia'],
    minutes: 15,
  },
  { name: 'Altglas wegbringen', repeat: monthly(), start: -8 },
  { name: 'Staub wischen', room: 'Wohnzimmer', repeat: weekly(2), start: -11, minutes: 20 },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 5, medium: 12, large: 120 });
  return {
    routine: Array.from({ length: n }, (_, i) => {
      const def = DEFS[i % DEFS.length]!;
      const round = Math.floor(i / DEFS.length);
      const startDate = ctx.day(def.start - round);
      const people = def.people ?? [];
      return {
        id: ctx.id('routines', 'routine', i),
        data: {
          name: round === 0 ? def.name : `${def.name} ${round + 1}`,
          ...(def.room ? { room: def.room } : {}),
          repeat: def.repeat,
          startDate,
          // The first three are due today; the others come round on their rule's next day.
          dueDate: i < 3 ? ctx.today : firstDue({ repeat: def.repeat, startDate }, ctx.day(1)),
          people,
          turn: people.length ? Math.floor((i + 1) / 2) % people.length : 0,
          ...(def.minutes ? { minutes: def.minutes } : {}),
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
