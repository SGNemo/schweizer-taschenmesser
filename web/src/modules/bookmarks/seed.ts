import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

type Kind = 'link' | 'read' | 'watch' | 'place' | 'idea' | 'other';

const BASE: { title: string; kind: Kind; tags: string[]; note?: string; slug: string }[] = [
  {
    title: 'Anleitung: Balkonkräuter richtig schneiden',
    kind: 'read',
    tags: ['garten'],
    slug: 'kraeuter',
  },
  {
    title: 'Dokumentation über Alpenseen',
    kind: 'watch',
    tags: ['natur', 'film'],
    slug: 'alpenseen',
  },
  {
    title: 'Café mit Dachterrasse in der Altstadt',
    kind: 'place',
    tags: ['ausflug'],
    note: 'Samstags ab 10 Uhr offen',
    slug: 'cafe',
  },
  { title: 'Wochenmarkt-Karte der Region', kind: 'link', tags: ['einkaufen'], slug: 'markt' },
  {
    title: 'Idee: Fotobuch vom Sommerurlaub',
    kind: 'idea',
    tags: ['foto', 'urlaub'],
    slug: 'fotobuch',
  },
  { title: 'Artikel über Schlafhygiene', kind: 'read', tags: ['gesundheit'], slug: 'schlaf' },
  { title: 'Rezept: Ofengemüse mit Feta', kind: 'link', tags: ['kochen'], slug: 'ofengemuese' },
  {
    title: 'Wanderweg Hohe Schanz, 12 km',
    kind: 'place',
    tags: ['ausflug', 'wandern'],
    slug: 'wanderweg',
  },
  {
    title: 'Vortrag: Einstieg in die Astronomie',
    kind: 'watch',
    tags: ['wissen'],
    slug: 'astronomie',
  },
  {
    title: 'Fahrradroute entlang der Havel',
    kind: 'place',
    tags: ['rad', 'ausflug'],
    slug: 'havel',
  },
  {
    title: 'Kurzgeschichten-Sammlung zum Vorlesen',
    kind: 'read',
    tags: ['buch'],
    slug: 'geschichten',
  },
  {
    title: 'Sonstiges: Öffnungszeiten Stadtbibliothek',
    kind: 'other',
    tags: [],
    slug: 'bibliothek',
  },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 30, large: 250 });
  return {
    item: Array.from({ length: n }, (_, i) => {
      const b = BASE[i % BASE.length]!;
      const round = Math.floor(i / BASE.length);
      return {
        id: ctx.id('bookmarks', 'item', i),
        data: {
          title: round === 0 ? b.title : `${b.title} (${round + 1})`,
          url: `https://www.example.org/${b.slug}${round === 0 ? '' : `-${round + 1}`}`,
          kind: b.kind,
          tags: b.tags,
          ...(b.note ? { note: b.note } : {}),
          done: i % 4 === 3,
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
