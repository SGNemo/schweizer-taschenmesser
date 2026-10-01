import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

type Category = 'identity' | 'insurance' | 'contract' | 'tax' | 'health' | 'other';

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
    category: 'other',
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

// Only metadata: no blob is created. The page shows the entry without a file on this device.
function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 5, medium: 10, large: 80 });
  return {
    document: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('vault', 'document', i),
        data: {
          title: round === 0 ? b.title : `${b.title} (${round + 1})`,
          category: b.category,
          ...(b.note ? { note: b.note } : {}),
          ...(b.exp !== undefined ? { expiresOn: ctx.day(b.exp + round * 30) } : {}),
          fileName: b.file,
          fileType: b.type,
          fileSize: b.size,
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
