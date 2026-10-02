import { addDaysStr } from '@/core/time/dates';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

type Category = 'identity' | 'insurance' | 'contract' | 'warranty' | 'tax' | 'health' | 'other';

// exp: days from today until the document expires (undefined = no expiry)
const BASE: {
  title: string;
  category: Category;
  exp?: number;
  file: string;
  type: string;
  size: number;
  note?: string;
}[] = [
  {
    title: 'Reisepass',
    category: 'identity',
    exp: 38,
    file: 'reisepass.pdf',
    type: 'application/pdf',
    size: 482_000,
    note: 'Verlängerung rechtzeitig beantragen',
  },
  {
    title: 'Personalausweis',
    category: 'identity',
    exp: 410,
    file: 'ausweis.jpg',
    type: 'image/jpeg',
    size: 913_000,
  },
  {
    title: 'Hausratversicherung Police',
    category: 'insurance',
    exp: 140,
    file: 'hausrat-police.pdf',
    type: 'application/pdf',
    size: 256_000,
  },
  {
    title: 'Haftpflichtversicherung',
    category: 'insurance',
    exp: 21,
    file: 'haftpflicht.pdf',
    type: 'application/pdf',
    size: 198_000,
  },
  {
    title: 'Mietvertrag Wohnung',
    category: 'contract',
    file: 'mietvertrag.pdf',
    type: 'application/pdf',
    size: 1_340_000,
  },
  {
    title: 'Steuerbescheid 2024',
    category: 'tax',
    file: 'steuerbescheid-2024.pdf',
    type: 'application/pdf',
    size: 312_000,
  },
  {
    title: 'Impfpass',
    category: 'health',
    exp: -9,
    file: 'impfpass.jpg',
    type: 'image/jpeg',
    size: 740_000,
    note: 'Auffrischung fällig',
  },
  {
    title: 'Garantie Waschmaschine',
    category: 'warranty',
    exp: 520,
    file: 'garantie-waschmaschine.pdf',
    type: 'application/pdf',
    size: 160_000,
  },
  {
    title: 'Führerschein',
    category: 'identity',
    exp: 900,
    file: 'fuehrerschein.jpg',
    type: 'image/jpeg',
    size: 620_000,
  },
  {
    title: 'Zahnbonusheft',
    category: 'health',
    file: 'bonusheft.pdf',
    type: 'application/pdf',
    size: 270_000,
  },
];

// Contracts, insurances and warranties (since 0.6.0 documents with a term and a notice period).
interface ContractBase {
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

const CONTRACTS: ContractBase[] = [
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
const CONTRACT_NAMES = [
  'Zeitschriften-Abo',
  'Kfz-Versicherung',
  'Rechtsschutz',
  'Kühlschrank Garantie',
  'Streaming-Dienst',
  'Gartenpflege',
  'Wartungsvertrag Heizung',
  'Cloud-Speicher',
];
const CONTRACT_PROVIDERS = [
  'Sonnenkamm AG',
  'Beispiel & Söhne GmbH',
  'Waldmeier Service',
  'Rosenau Direkt',
  'Blauer Anker Versicherung',
];
const CONTRACT_KINDS = ['contract', 'insurance', 'warranty'] as const;

// Only metadata: no blob is created. The page shows the entry without a file on this device.
function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 5, medium: 10, large: 80 });
  const m = ctx.count({ small: 6, medium: 24, large: 250 });
  const contracts: ContractBase[] = CONTRACTS.slice(0, Math.min(m, CONTRACTS.length));
  for (let i = contracts.length; i < m; i++) {
    const kind = ctx.rng.pick(CONTRACT_KINDS);
    contracts.push({
      name: `${ctx.rng.pick(CONTRACT_NAMES)} ${i}`,
      kind,
      provider: ctx.rng.pick(CONTRACT_PROVIDERS),
      end: ctx.rng.int(-60, 600),
      noticeDays: kind === 'warranty' ? undefined : ctx.rng.pick([14, 30, 60, 90]),
      term: ctx.rng.pick([365, 730]),
    });
  }
  return {
    document: [
      ...Array.from({ length: n }, (_, i) => {
        const b = BASE[i % BASE.length]!;
        const round = Math.floor(i / BASE.length);
        return {
          id: ctx.id('vault', 'document', i),
          data: {
            title: round === 0 ? b.title : `${b.title} (${round + 1})`,
            category: b.category,
            ...(b.note ? { note: b.note } : {}),
            ...(b.exp !== undefined ? { endDate: ctx.day(b.exp + round * 30) } : {}),
            fileName: b.file,
            fileType: b.type,
            fileSize: b.size,
          },
        };
      }),
      ...contracts.map((b, i) => {
        const endDate = ctx.day(b.end);
        const data: Record<string, unknown> = {
          title: b.name,
          category: b.kind,
          provider: b.provider,
          startDate: addDaysStr(endDate, -b.term),
          endDate,
        };
        if (b.noticeDays !== undefined) data.noticeDays = b.noticeDays;
        if (b.note) data.note = b.note;
        return { id: ctx.id('vault', 'contract', i), data };
      }),
    ],
  };
}

export default { seed } satisfies SeedModule;
