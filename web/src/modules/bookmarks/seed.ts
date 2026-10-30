import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German. */
const TR: Record<string, readonly [string, string, string, string]> = {
  'Anleitung: Balkonkräuter richtig schneiden': [
    'Guide: how to prune balcony herbs',
    'Guía: cómo podar las hierbas del balcón',
    'Guide : bien tailler les herbes du balcon',
    'Guia: como podar as ervas da varanda',
  ],
  'Dokumentation über Alpenseen': [
    'Documentary about alpine lakes',
    'Documental sobre los lagos alpinos',
    'Documentaire sur les lacs alpins',
    'Documentário sobre os lagos alpinos',
  ],
  'Café mit Dachterrasse in der Altstadt': [
    'Café with a roof terrace in the old town',
    'Café con terraza en la azotea en el casco antiguo',
    'Café avec toit-terrasse dans la vieille ville',
    'Café com terraço na cobertura no centro histórico',
  ],
  'Wochenmarkt-Karte der Region': [
    'Map of the region’s weekly markets',
    'Mapa de los mercados semanales de la zona',
    'Carte des marchés de la région',
    'Mapa das feiras da região',
  ],
  'Idee: Fotobuch vom Sommerurlaub': [
    'Idea: photo book of the summer holiday',
    'Idea: álbum de fotos de las vacaciones de verano',
    'Idée : livre photo des vacances d’été',
    'Ideia: álbum de fotos das férias de verão',
  ],
  'Artikel über Schlafhygiene': [
    'Article about sleep hygiene',
    'Artículo sobre higiene del sueño',
    'Article sur l’hygiène du sommeil',
    'Artigo sobre higiene do sono',
  ],
  'Rezept: Ofengemüse mit Feta': [
    'Recipe: roasted vegetables with feta',
    'Receta: verduras al horno con feta',
    'Recette : légumes rôtis à la feta',
    'Receita: legumes assados com feta',
  ],
  'Wanderweg Hohe Schanz, 12 km': [
    'Hohe Schanz hiking trail, 12 km',
    'Ruta de senderismo Hohe Schanz, 12 km',
    'Sentier de randonnée Hohe Schanz, 12 km',
    'Trilha Hohe Schanz, 12 km',
  ],
  'Vortrag: Einstieg in die Astronomie': [
    'Talk: getting started with astronomy',
    'Charla: introducción a la astronomía',
    'Conférence : initiation à l’astronomie',
    'Palestra: primeiros passos na astronomia',
  ],
  'Fahrradroute entlang der Havel': [
    'Cycle route along the Havel',
    'Ruta en bici a lo largo del Havel',
    'Itinéraire à vélo le long de la Havel',
    'Rota de bicicleta ao longo do Havel',
  ],
  'Kurzgeschichten-Sammlung zum Vorlesen': [
    'Short story collection for reading aloud',
    'Colección de cuentos para leer en voz alta',
    'Recueil de nouvelles à lire à voix haute',
    'Coletânea de contos para ler em voz alta',
  ],
  'Sonstiges: Öffnungszeiten Stadtbibliothek': [
    'Other: city library opening hours',
    'Otros: horario de la biblioteca municipal',
    'Divers : horaires de la bibliothèque municipale',
    'Outros: horário da biblioteca municipal',
  ],
  'Samstags ab 10 Uhr offen': [
    'Open Saturdays from 10 a.m.',
    'Abierto los sábados desde las 10:00',
    'Ouvert le samedi dès 10 h',
    'Aberto aos sábados a partir das 10h',
  ],
  garten: ['garden', 'jardín', 'jardin', 'jardim'],
  natur: ['nature', 'naturaleza', 'nature', 'natureza'],
  film: ['film', 'cine', 'film', 'filme'],
  ausflug: ['outing', 'excursión', 'sortie', 'passeio'],
  einkaufen: ['shopping', 'compras', 'courses', 'compras'],
  foto: ['photo', 'foto', 'photo', 'foto'],
  urlaub: ['holiday', 'vacaciones', 'vacances', 'férias'],
  gesundheit: ['health', 'salud', 'santé', 'saúde'],
  kochen: ['cooking', 'cocina', 'cuisine', 'culinária'],
  wandern: ['hiking', 'senderismo', 'randonnée', 'trilha'],
  wissen: ['knowledge', 'saber', 'savoir', 'conhecimento'],
  rad: ['cycling', 'bici', 'vélo', 'bicicleta'],
  buch: ['book', 'libro', 'livre', 'livro'],
  'DHL Sendungsverfolgung': [
    'DHL parcel tracking',
    'Seguimiento de envíos DHL',
    'Suivi de colis DHL',
    'Rastreamento de encomendas DHL',
  ],
  'Hermes Paketstatus': [
    'Hermes parcel status',
    'Estado de paquetes Hermes',
    'Statut des colis Hermes',
    'Status de encomendas Hermes',
  ],
  'Bahn Fahrplanauskunft': [
    'Train timetable',
    'Horarios de trenes',
    'Horaires de train',
    'Horários de trem',
  ],
  'Karten und Routen': [
    'Maps and routes',
    'Mapas y rutas',
    'Cartes et itinéraires',
    'Mapas e rotas',
  ],
  'Wetter für die Woche': [
    'Weather for the week',
    'El tiempo de la semana',
    'Météo de la semaine',
    'Previsão da semana',
  ],
  'Messenger im Browser': [
    'Messenger in the browser',
    'Mensajería en el navegador',
    'Messagerie dans le navigateur',
    'Mensageiro no navegador',
  ],
  'Streaming-Mediathek': [
    'Streaming library',
    'Mediateca de streaming',
    'Médiathèque en streaming',
    'Mediateca de streaming',
  ],
  'Stadtplan und Ämter': [
    'City map and offices',
    'Plano de la ciudad y oficinas',
    'Plan de la ville et services',
    'Mapa da cidade e repartições',
  ],
  Pakete: ['Parcels', 'Paquetes', 'Colis', 'Encomendas'],
  Reisen: ['Travel', 'Viajes', 'Voyages', 'Viagens'],
  Kommunikation: ['Communication', 'Comunicación', 'Communication', 'Comunicação'],
  Freizeit: ['Leisure', 'Ocio', 'Loisirs', 'Lazer'],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (ctx: SeedContext, de: string): string =>
  ctx.lang === 'de' ? de : (TR[de]?.[LANG_INDEX[ctx.lang]] ?? de);

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

/** "Lesezeichen": links as tiles, the first tag is the group. */
const LINKS: { title: string; tags: string[]; slug: string }[] = [
  { title: 'DHL Sendungsverfolgung', tags: ['Pakete'], slug: 'dhl' },
  { title: 'Hermes Paketstatus', tags: ['Pakete'], slug: 'hermes' },
  { title: 'Bahn Fahrplanauskunft', tags: ['Reisen'], slug: 'bahn' },
  { title: 'Karten und Routen', tags: ['Reisen'], slug: 'karten' },
  { title: 'Wetter für die Woche', tags: [], slug: 'wetter' },
  { title: 'Messenger im Browser', tags: ['Kommunikation'], slug: 'messenger' },
  { title: 'Streaming-Mediathek', tags: ['Freizeit'], slug: 'mediathek' },
  { title: 'Stadtplan und Ämter', tags: ['Freizeit'], slug: 'stadt' },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 6, medium: 30, large: 250 });
  const links = ctx.count({ small: 4, medium: 8, large: 8 });
  return {
    item: [
      ...LINKS.slice(0, links).map((l, i) => ({
        id: ctx.id('bookmarks', 'item', `link-${i}`),
        data: {
          title: tr(ctx, l.title),
          url: `https://www.example.org/${l.slug}`,
          kind: 'link' as const,
          tags: l.tags.map((x) => tr(ctx, x)),
          done: false,
        },
      })),
      ...Array.from({ length: n }, (_, i) => {
        const b = BASE[i % BASE.length]!;
        const round = Math.floor(i / BASE.length);
        return {
          id: ctx.id('bookmarks', 'item', i),
          data: {
            title: round === 0 ? tr(ctx, b.title) : `${tr(ctx, b.title)} (${round + 1})`,
            url: `https://www.example.org/${b.slug}${round === 0 ? '' : `-${round + 1}`}`,
            kind: b.kind,
            tags: b.tags.map((x) => tr(ctx, x)),
            ...(b.note ? { note: tr(ctx, b.note) } : {}),
            done: i % 4 === 3,
          },
        };
      }),
    ],
  };
}

export default { seed } satisfies SeedModule;
