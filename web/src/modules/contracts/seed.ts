import { addDaysStr } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

interface Base {
  name: string;
  kind: 'contract' | 'insurance' | 'warranty';
  provider: string;
  /** Days until the end of the term (negative = already over). */
  end: number;
  noticeDays?: number;
  /** Term length in days (start = end - term). */
  term: number;
  note?: string;
}

const BASE: Base[] = [
  {
    name: 'Handyvertrag',
    kind: 'contract',
    provider: 'Funkwelle Mobil GmbH',
    end: 21,
    noticeDays: 30,
    term: 730,
    note: 'Kündigung schriftlich',
  },
  {
    name: 'Internet & Telefon',
    kind: 'contract',
    provider: 'Nordlicht Telekom AG',
    end: 75,
    noticeDays: 90,
    term: 730,
  },
  {
    name: 'Hausratversicherung',
    kind: 'insurance',
    provider: 'Sicherhaus Versicherung AG',
    end: 120,
    noticeDays: 30,
    term: 365,
  },
  {
    name: 'Haftpflichtversicherung',
    kind: 'insurance',
    provider: 'Eichenschild Versicherungen',
    end: 200,
    noticeDays: 30,
    term: 365,
  },
  {
    name: 'Fitnessstudio',
    kind: 'contract',
    provider: 'FitFabrik Musterstadt',
    end: 9,
    noticeDays: 14,
    term: 365,
  },
  {
    name: 'Waschmaschine Garantie',
    kind: 'warranty',
    provider: 'Haushaltswelt Beispiel',
    end: 45,
    term: 730,
  },
  {
    name: 'Stromvertrag',
    kind: 'contract',
    provider: 'Stadtwerke Beispielstadt',
    end: 300,
    noticeDays: 42,
    term: 365,
  },
  {
    name: 'Laptop Garantie',
    kind: 'warranty',
    provider: 'Technikhaus Lindner',
    end: -30,
    term: 730,
  },
];
const NAMES = [
  'Zeitschriften-Abo',
  'Kfz-Versicherung',
  'Rechtsschutz',
  'Kühlschrank Garantie',
  'Streaming-Dienst',
  'Gartenpflege',
  'Wartungsvertrag Heizung',
  'Cloud-Speicher',
];
const PROVIDERS = [
  'Sonnenkamm AG',
  'Beispiel & Söhne GmbH',
  'Waldmeier Service',
  'Rosenau Direkt',
  'Blauer Anker Versicherung',
];
const KINDS = ['contract', 'insurance', 'warranty'] as const;

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 24, large: 250 });
  const list: Base[] = BASE.slice(0, Math.min(n, BASE.length));
  for (let i = list.length; i < n; i++) {
    const kind = ctx.rng.pick(KINDS);
    list.push({
      name: `${ctx.rng.pick(NAMES)} ${i}`,
      kind,
      provider: ctx.rng.pick(PROVIDERS),
      end: ctx.rng.int(-60, 600),
      noticeDays: kind === 'warranty' ? undefined : ctx.rng.pick([14, 30, 60, 90]),
      term: ctx.rng.pick([365, 730]),
    });
  }
  return {
    contract: list.map((b, i) => {
      const endDate = ctx.day(b.end);
      const data: Record<string, unknown> = {
        name: b.name,
        kind: b.kind,
        provider: b.provider,
        startDate: addDaysStr(endDate, -b.term),
        endDate,
      };
      if (b.noticeDays !== undefined) data.noticeDays = b.noticeDays;
      if (b.note) data.note = b.note;
      return { id: ctx.id('contracts', 'contract', i), data };
    }),
  };
}

export default { seed } satisfies SeedModule;
