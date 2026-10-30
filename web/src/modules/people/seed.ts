import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const FIRST = [
  'Anna',
  'Lukas',
  'Mira',
  'Jonas',
  'Clara',
  'Felix',
  'Lena',
  'Paul',
  'Sophie',
  'Max',
  'Nora',
  'Tim',
  'Emma',
  'Leon',
  'Hanna',
  'Ben',
  'Marie',
  'Elias',
  'Greta',
  'Oskar',
  'Ida',
  'Finn',
  'Johanna',
  'Theo',
  'Luise',
  'Moritz',
  'Frieda',
  'Karl',
  'Rosa',
  'Niko',
];
const LAST = [
  'Beispiel',
  'Musterfrau',
  'Testmann',
  'Lindner',
  'Bergmann',
  'Sonnleitner',
  'Waldmeier',
  'Kaltenbach',
  'Rosenau',
  'Fichtner',
  'Brunnhuber',
  'Lerchenfeld',
  'Auerbacher',
  'Seidlmayr',
];
const NOTES = [
  'Kollegin',
  'Nachbar',
  'Cousine',
  'Schulfreund',
  'Sportverein',
  'Onkel',
  'Patenkind',
];
/** German source text → [en, es, fr, pt-BR]; a text without an entry stays German (first and last names do). */
const TR: Record<string, readonly [string, string, string, string]> = {
  Kollegin: ['Colleague', 'Compañera de trabajo', 'Collègue', 'Colega de trabalho'],
  Nachbar: ['Neighbour', 'Vecino', 'Voisin', 'Vizinho'],
  Cousine: ['Cousin', 'Prima', 'Cousine', 'Prima'],
  Schulfreund: ['School friend', 'Amigo del colegio', 'Ami d’école', 'Amigo da escola'],
  Sportverein: ['Sports club', 'Club deportivo', 'Club de sport', 'Clube esportivo'],
  Onkel: ['Uncle', 'Tío', 'Oncle', 'Tio'],
  Patenkind: ['Godchild', 'Ahijado', 'Filleul', 'Afilhado'],
  'Kochbuch "Italien einfach"': [
    'Cookbook “Italy made easy”',
    'Libro de cocina «Italia fácil»',
    'Livre de cuisine « L’Italie facile »',
    'Livro de receitas “Itália fácil”',
  ],
  'Wanderrucksack 28 l': [
    'Hiking backpack 28 l',
    'Mochila de senderismo 28 l',
    'Sac à dos de randonnée 28 l',
    'Mochila de trilha 28 l',
  ],
  'Gutschein Töpferkurs': [
    'Voucher for a pottery class',
    'Vale para un curso de cerámica',
    'Bon pour un cours de poterie',
    'Vale para um curso de cerâmica',
  ],
  'Gesellschaftsspiel für vier': [
    'Board game for four',
    'Juego de mesa para cuatro',
    'Jeu de société pour quatre',
    'Jogo de tabuleiro para quatro',
  ],
  'Handgemachte Kerzen': [
    'Handmade candles',
    'Velas hechas a mano',
    'Bougies artisanales',
    'Velas artesanais',
  ],
  'Fotokalender mit Familienbildern': [
    'Photo calendar with family pictures',
    'Calendario de fotos con imágenes familiares',
    'Calendrier photo avec des images de famille',
    'Calendário de fotos com imagens da família',
  ],
  'Bluetooth-Lautsprecher': [
    'Bluetooth speaker',
    'Altavoz Bluetooth',
    'Enceinte Bluetooth',
    'Caixa de som Bluetooth',
  ],
  'Blumenstrauß und Karte': [
    'Bouquet and card',
    'Ramo de flores y tarjeta',
    'Bouquet et carte',
    'Buquê e cartão',
  ],
  'Tee-Set mit Kanne': [
    'Tea set with pot',
    'Juego de té con tetera',
    'Service à thé avec théière',
    'Conjunto de chá com bule',
  ],
  'Taschenlampe mit Dynamo': [
    'Dynamo torch',
    'Linterna de dinamo',
    'Lampe de poche à dynamo',
    'Lanterna com dínamo',
  ],
  'Schal aus Merinowolle': [
    'Merino wool scarf',
    'Bufanda de lana merina',
    'Écharpe en laine mérinos',
    'Cachecol de lã merino',
  ],
  Konzertkarten: [
    'Concert tickets',
    'Entradas de concierto',
    'Billets de concert',
    'Ingressos de show',
  ],
  Geburtstag: ['Birthday', 'Cumpleaños', 'Anniversaire', 'Aniversário'],
  Jubiläum: ['Anniversary', 'Aniversario', 'Anniversaire de mariage', 'Bodas'],
  Einweihung: ['Housewarming', 'Inauguración', 'Pendaison de crémaillère', 'Chá de casa nova'],
  Weihnachten: ['Christmas', 'Navidad', 'Noël', 'Natal'],
  Dankeschön: ['Thank you', 'Agradecimiento', 'Remerciement', 'Agradecimento'],
  Abschied: ['Farewell', 'Despedida', 'Départ', 'Despedida'],
  'Versteckt im Schrank': [
    'Hidden in the cupboard',
    'Escondido en el armario',
    'Caché dans le placard',
    'Escondido no armário',
  ],
};
const LANG_INDEX = { en: 0, es: 1, fr: 2, 'pt-BR': 3 } as const;
const tr = (ctx: SeedContext, de: string): string =>
  ctx.lang === 'de' ? de : (TR[de]?.[LANG_INDEX[ctx.lang]] ?? de);

/** Days from today to the next birthday: some inside 7 and 30 days, some later, one today. */
const SOON = [0, 2, 5, 9, 16, 24, 41, 75];

type GiftStatus = 'idea' | 'bought' | 'given';

const GIFTS: {
  title: string;
  occasion: string;
  in: number;
  price: number;
  status: GiftStatus;
  note?: string;
}[] = [
  {
    title: 'Kochbuch "Italien einfach"',
    occasion: 'Geburtstag',
    in: 9,
    price: 2490,
    status: 'idea',
  },
  {
    title: 'Wanderrucksack 28 l',
    occasion: 'Geburtstag',
    in: 21,
    price: 8900,
    status: 'bought',
    note: 'Versteckt im Schrank',
  },
  {
    title: 'Gutschein Töpferkurs',
    occasion: 'Jubiläum',
    in: 34,
    price: 6500,
    status: 'idea',
  },
  {
    title: 'Gesellschaftsspiel für vier',
    occasion: 'Einweihung',
    in: 4,
    price: 3290,
    status: 'bought',
  },
  {
    title: 'Handgemachte Kerzen',
    occasion: 'Weihnachten',
    in: 84,
    price: 1800,
    status: 'idea',
  },
  {
    title: 'Fotokalender mit Familienbildern',
    occasion: 'Weihnachten',
    in: 84,
    price: 2200,
    status: 'idea',
  },
  {
    title: 'Bluetooth-Lautsprecher',
    occasion: 'Geburtstag',
    in: -12,
    price: 4900,
    status: 'given',
  },
  {
    title: 'Blumenstrauß und Karte',
    occasion: 'Dankeschön',
    in: 2,
    price: 1500,
    status: 'idea',
  },
  {
    title: 'Tee-Set mit Kanne',
    occasion: 'Abschied',
    in: 15,
    price: 3400,
    status: 'idea',
  },
  {
    title: 'Taschenlampe mit Dynamo',
    occasion: 'Geburtstag',
    in: 47,
    price: 1990,
    status: 'idea',
  },
  {
    title: 'Schal aus Merinowolle',
    occasion: 'Weihnachten',
    in: 84,
    price: 4500,
    status: 'bought',
  },
  {
    title: 'Konzertkarten',
    occasion: 'Geburtstag',
    in: -30,
    price: 7800,
    status: 'given',
  },
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 8, medium: 28, large: 300 });
  const g = ctx.count({ small: 6, medium: 12, large: 90 });
  const todayYear = Number(ctx.today.slice(0, 4));
  const person = Array.from({ length: n }, (_, i) => {
    const offset = i < SOON.length ? SOON[i]! : ctx.rng.int(1, 364);
    const [, m, d] = ctx.day(offset).split('-').map(Number) as [number, number, number];
    const first = FIRST[i % FIRST.length]!;
    const last = i < FIRST.length ? LAST[i % LAST.length]! : `${ctx.rng.pick(LAST)}`;
    const birthday: Record<string, number> = { month: m, day: d };
    if (ctx.rng.chance(0.7)) birthday.year = todayYear - ctx.rng.int(4, 80);
    const data: Record<string, unknown> = { name: `${first} ${last}`, birthday };
    if (ctx.rng.chance(0.3)) data.note = tr(ctx, ctx.rng.pick(NOTES));
    return { id: ctx.id('people', 'person', i), data };
  });
  const gift = Array.from({ length: g }, (_, i) => {
    const b = GIFTS[i % GIFTS.length]!;
    const round = Math.floor(i / GIFTS.length);
    return {
      id: ctx.id('people', 'gift', i),
      data: {
        personId: ctx.id('people', 'person', i % n),
        title:
          round === 0
            ? tr(ctx, b.title)
            : `${tr(ctx, b.title)} (${ctx.text({ de: 'Variante', en: 'Option', es: 'Variante', fr: 'Variante', 'pt-BR': 'Variante' })} ${round + 1})`,
        occasion: tr(ctx, b.occasion),
        date: ctx.day(b.in + round * 7),
        priceCents: b.price + round * 100,
        ...(i % 3 === 0 ? { url: `https://shop.example.org/geschenk-${i}` } : {}),
        status: round === 0 ? b.status : i % 5 === 0 ? 'bought' : 'idea',
        ...(b.note ? { note: tr(ctx, b.note) } : {}),
      },
    };
  });
  return { person, gift };
}

export default { seed } satisfies SeedModule;
