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

/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German (company names do). */
const TR: Record<string, readonly [string, string, string, string]> = {
  Reisepass: ['Passport', 'Pasaporte', 'Passeport', 'Passaporte'],
  Personalausweis: [
    'ID card',
    'Documento de identidad',
    'Carte d’identité',
    'Carteira de identidade',
  ],
  'Hausratversicherung Police': [
    'Home contents insurance policy',
    'Póliza del seguro del hogar',
    'Police d’assurance habitation',
    'Apólice do seguro residencial',
  ],
  Haftpflichtversicherung: [
    'Liability insurance',
    'Seguro de responsabilidad civil',
    'Assurance responsabilité civile',
    'Seguro de responsabilidade civil',
  ],
  'Mietvertrag Wohnung': [
    'Flat rental agreement',
    'Contrato de alquiler del piso',
    'Bail de l’appartement',
    'Contrato de aluguel do apartamento',
  ],
  'Steuerbescheid 2024': [
    'Tax assessment 2024',
    'Liquidación de impuestos 2024',
    'Avis d’imposition 2024',
    'Notificação de imposto 2024',
  ],
  Impfpass: [
    'Vaccination record',
    'Cartilla de vacunación',
    'Carnet de vaccination',
    'Carteira de vacinação',
  ],
  'Garantie Waschmaschine': [
    'Washing machine warranty',
    'Garantía de la lavadora',
    'Garantie du lave-linge',
    'Garantia da máquina de lavar',
  ],
  Führerschein: [
    'Driving licence',
    'Carné de conducir',
    'Permis de conduire',
    'Carteira de motorista',
  ],
  Zahnbonusheft: [
    'Dental bonus booklet',
    'Cartilla de revisiones dentales',
    'Carnet de suivi dentaire',
    'Caderneta odontológica',
  ],
  'Verlängerung rechtzeitig beantragen': [
    'Apply for renewal in good time',
    'Solicitar la renovación con tiempo',
    'Demander le renouvellement à temps',
    'Pedir a renovação com antecedência',
  ],
  'Auffrischung fällig': [
    'Booster due',
    'Refuerzo pendiente',
    'Rappel à faire',
    'Reforço pendente',
  ],
  Handyvertrag: ['Mobile plan', 'Contrato de móvil', 'Forfait mobile', 'Plano de celular'],
  'Kündigung schriftlich': [
    'Cancel in writing',
    'Cancelar por escrito',
    'Résiliation par écrit',
    'Cancelar por escrito',
  ],
  'Internet & Telefon': [
    'Internet & phone',
    'Internet y teléfono',
    'Internet et téléphone',
    'Internet e telefone',
  ],
  Hausratversicherung: [
    'Home contents insurance',
    'Seguro del hogar',
    'Assurance habitation',
    'Seguro residencial',
  ],
  Fitnessstudio: ['Gym', 'Gimnasio', 'Salle de sport', 'Academia'],
  'Waschmaschine Garantie': [
    'Washing machine warranty',
    'Garantía de la lavadora',
    'Garantie du lave-linge',
    'Garantia da máquina de lavar',
  ],
  Stromvertrag: [
    'Electricity contract',
    'Contrato de luz',
    'Contrat d’électricité',
    'Contrato de energia',
  ],
  'Laptop Garantie': [
    'Laptop warranty',
    'Garantía del portátil',
    'Garantie de l’ordinateur portable',
    'Garantia do notebook',
  ],
  'Zeitschriften-Abo': [
    'Magazine subscription',
    'Suscripción a revista',
    'Abonnement magazine',
    'Assinatura de revista',
  ],
  'Kfz-Versicherung': ['Car insurance', 'Seguro de coche', 'Assurance auto', 'Seguro de carro'],
  Rechtsschutz: [
    'Legal expenses insurance',
    'Seguro de defensa jurídica',
    'Protection juridique',
    'Seguro de proteção jurídica',
  ],
  'Kühlschrank Garantie': [
    'Fridge warranty',
    'Garantía del frigorífico',
    'Garantie du réfrigérateur',
    'Garantia da geladeira',
  ],
  'Streaming-Dienst': [
    'Streaming service',
    'Servicio de streaming',
    'Service de streaming',
    'Serviço de streaming',
  ],
  Gartenpflege: ['Garden care', 'Cuidado del jardín', 'Entretien du jardin', 'Cuidado do jardim'],
  'Wartungsvertrag Heizung': [
    'Heating maintenance contract',
    'Contrato de mantenimiento de la calefacción',
    'Contrat d’entretien du chauffage',
    'Contrato de manutenção do aquecimento',
  ],
  'Cloud-Speicher': [
    'Cloud storage',
    'Almacenamiento en la nube',
    'Stockage cloud',
    'Armazenamento na nuvem',
  ],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (ctx: SeedContext, de: string): string =>
  ctx.lang === 'de' ? de : (TR[de]?.[LANG_INDEX[ctx.lang]] ?? de);

// Only metadata: no blob is created. The page shows the entry without a file on this device.
function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 5, medium: 10, large: 80 });
  const m = ctx.count({ small: 6, medium: 24, large: 250 });
  const contracts: ContractBase[] = CONTRACTS.slice(0, Math.min(m, CONTRACTS.length));
  for (let i = contracts.length; i < m; i++) {
    const kind = ctx.rng.pick(CONTRACT_KINDS);
    contracts.push({
      name: `${tr(ctx, ctx.rng.pick(CONTRACT_NAMES))} ${i}`,
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
            title: round === 0 ? tr(ctx, b.title) : `${tr(ctx, b.title)} (${round + 1})`,
            category: b.category,
            ...(b.note ? { note: tr(ctx, b.note) } : {}),
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
          title: tr(ctx, b.name),
          category: b.kind,
          provider: b.provider,
          startDate: addDaysStr(endDate, -b.term),
          endDate,
        };
        if (b.noticeDays !== undefined) data.noticeDays = b.noticeDays;
        if (b.note) data.note = tr(ctx, b.note);
        return { id: ctx.id('vault', 'contract', i), data };
      }),
    ],
  };
}

export default { seed } satisfies SeedModule;
