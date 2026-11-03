import type { SeedContext, SeedModule, SeedRow, SeedRows } from '@/core/seed/types';
import { addDaysStr, isoWeekday } from '@/core/time/dates';

/**
 * Test data: two clients, three projects with rates and colours (one not billable) and weekday
 * sessions over the last days, none running. Pure and deterministic; dates relative to `ctx.today`.
 */
type L = { de: string; en: string; es: string; fr: string; 'pt-BR': string };

const CLIENTS: L[] = [
  {
    de: 'Hofmann & Söhne',
    en: 'Hofmann & Sons',
    es: 'Hofmann e Hijos',
    fr: 'Hofmann & Fils',
    'pt-BR': 'Hofmann & Filhos',
  },
  {
    de: 'Atelier Lindner',
    en: 'Atelier Lindner',
    es: 'Atelier Lindner',
    fr: 'Atelier Lindner',
    'pt-BR': 'Atelier Lindner',
  },
];
const JOBS: {
  name: L;
  client: number | null;
  tone: number;
  rate: number | null;
  billable: boolean;
}[] = [
  {
    name: {
      de: 'Website Relaunch',
      en: 'Website relaunch',
      es: 'Rediseño web',
      fr: 'Refonte du site',
      'pt-BR': 'Redesenho do site',
    },
    client: 0,
    tone: 0,
    rate: 7500,
    billable: true,
  },
  {
    name: {
      de: 'Buchhaltung',
      en: 'Bookkeeping',
      es: 'Contabilidad',
      fr: 'Comptabilité',
      'pt-BR': 'Contabilidade',
    },
    client: 1,
    tone: 2,
    rate: 5500,
    billable: true,
  },
  {
    name: {
      de: 'Weiterbildung',
      en: 'Training',
      es: 'Formación',
      fr: 'Formation',
      'pt-BR': 'Treinamento',
    },
    client: null,
    tone: 4,
    rate: null,
    billable: false,
  },
];
/** Typical blocks: [job index, start, end, break]. */
const DAYS: [number, string, string, number][][] = [
  [
    [0, '09:00', '12:30', 0],
    [1, '13:30', '16:00', 15],
  ],
  [
    [0, '08:30', '12:00', 10],
    [2, '13:00', '14:30', 0],
  ],
  [
    [1, '09:30', '11:30', 0],
    [0, '12:30', '17:00', 30],
  ],
];

const pad = (n: number) => String(n).padStart(2, '0');

function seed(ctx: SeedContext): SeedRows {
  const nJobs = ctx.count({ small: 1, medium: 3, large: 3 });
  const days = ctx.count({ small: 4, medium: 40, large: 200 });
  const clients: SeedRow[] = CLIENTS.map((c, i) => ({
    id: ctx.id('timetrack', 'client', i),
    data: { name: ctx.text(c), order: i },
  }));
  const jobs: SeedRow[] = JOBS.slice(0, nJobs).map((j, i) => ({
    id: ctx.id('timetrack', 'job', i),
    data: {
      name: ctx.text(j.name),
      ...(j.client !== null ? { clientId: clients[j.client]!.id } : {}),
      tone: j.tone,
      ...(j.rate !== null ? { rateCents: j.rate } : {}),
      billable: j.billable,
      order: i,
    },
  }));
  const sessions: SeedRow[] = [];
  let n = 0;
  for (let back = 0; back < days; back++) {
    const date = addDaysStr(ctx.today, -back);
    if (isoWeekday(date) > 5) continue;
    const plan = DAYS[(back + ctx.rng.int(0, 2)) % DAYS.length]!;
    // Today holds one finished block so the widget shows a total without a running timer.
    const blocks = back === 0 ? plan.slice(0, 1) : plan;
    for (const [job, start, end, breakMin] of blocks) {
      const jobIndex = Math.min(job, nJobs - 1);
      const jitter = ctx.rng.int(0, 3) * 5;
      const [eh, em] = end.split(':').map(Number) as [number, number];
      const total = eh * 60 + em + jitter;
      sessions.push({
        id: ctx.id('timetrack', 'session', n++),
        data: {
          jobId: jobs[jobIndex]!.id,
          date,
          startTime: start,
          endTime: `${pad(Math.floor(total / 60))}:${pad(total % 60)}`,
          breakMin,
        },
      });
    }
  }
  return { client: clients, job: jobs, session: sessions };
}

export default { seed } satisfies SeedModule;
