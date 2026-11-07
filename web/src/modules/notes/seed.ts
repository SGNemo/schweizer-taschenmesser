import type { ByLang } from '@/core/i18n/lang';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const TITLES: ByLang<string[]> = {
  de: [
    'Ideen für den Balkon',
    'Wochenplan Meal-Prep',
    'Urlaub Ostsee: Packliste & Tipps',
    'Bücher, die ich lesen will',
    'Renovierung Bad – Fragen an den Installateur',
    'Geschenkideen Weihnachten',
    'Rezept: Linseneintopf',
    'Fahrradwartung',
    'Notizen vom Elternabend',
    'Lernplan Spanisch',
  ],
  en: [
    'Ideas for the balcony',
    'Weekly meal prep plan',
    'Seaside holiday: packing list & tips',
    'Books I want to read',
    'Bathroom renovation – questions for the plumber',
    'Christmas gift ideas',
    'Recipe: lentil stew',
    'Bike maintenance',
    'Notes from the parents’ evening',
    'Spanish study plan',
  ],
  es: [
    'Ideas para el balcón',
    'Plan semanal de comidas',
    'Vacaciones en la costa: lista de equipaje y consejos',
    'Libros que quiero leer',
    'Reforma del baño: preguntas al fontanero',
    'Ideas de regalos para Navidad',
    'Receta: guiso de lentejas',
    'Mantenimiento de la bici',
    'Apuntes de la reunión de padres',
    'Plan de estudio de alemán',
  ],
  fr: [
    'Idées pour le balcon',
    'Plan de repas de la semaine',
    'Vacances à la mer : liste de bagages et conseils',
    'Livres que je veux lire',
    'Rénovation de la salle de bain – questions au plombier',
    'Idées de cadeaux pour Noël',
    'Recette : ragoût de lentilles',
    'Entretien du vélo',
    'Notes de la réunion de parents',
    'Plan d’étude de l’espagnol',
  ],
  'pt-BR': [
    'Ideias para a varanda',
    'Plano semanal de refeições',
    'Férias na praia: lista de malas e dicas',
    'Livros que quero ler',
    'Reforma do banheiro – perguntas ao encanador',
    'Ideias de presentes de Natal',
    'Receita: ensopado de lentilhas',
    'Manutenção da bicicleta',
    'Anotações da reunião de pais',
    'Plano de estudo de espanhol',
  ],
};
const BODIES: ByLang<string[]> = {
  de: [
    'Kräuter in Kästen, Tomaten an die Südseite. Blumenerde und Rankhilfe besorgen.',
    'Montag Nudeln, Dienstag Suppe, Mittwoch Ofengemüse. Vorkochen am Sonntag.',
    'Strandkorb reservieren, Regenjacke nicht vergessen, Fischbrötchen in Warnemünde.',
    'Drei Bücher aus der Stadtbibliothek vormerken, eins davon als Hörbuch.',
    'Fliesenformat klären, Preis für die Dusche, Dauer der Arbeiten, Terminvorschlag.',
  ],
  en: [
    'Herbs in window boxes, tomatoes on the south side. Get potting soil and a trellis.',
    'Monday pasta, Tuesday soup, Wednesday roasted vegetables. Batch-cook on Sunday.',
    'Reserve a beach chair, don’t forget the rain jacket, fish sandwiches by the harbour.',
    'Reserve three books at the city library, one of them as an audiobook.',
    'Clarify tile size, price for the shower, how long the work takes, suggest a date.',
  ],
  es: [
    'Hierbas en jardineras, tomates en el lado sur. Comprar tierra y una guía para trepadoras.',
    'Lunes pasta, martes sopa, miércoles verduras al horno. Cocinar de antemano el domingo.',
    'Reservar una tumbona, no olvidar el chubasquero, bocadillos de pescado en el puerto.',
    'Reservar tres libros en la biblioteca municipal, uno de ellos como audiolibro.',
    'Aclarar el formato de las baldosas, el precio de la ducha, la duración de las obras y proponer una fecha.',
  ],
  fr: [
    'Herbes aromatiques en jardinières, tomates côté sud. Acheter du terreau et un treillis.',
    'Lundi pâtes, mardi soupe, mercredi légumes rôtis. Cuisiner à l’avance le dimanche.',
    'Réserver un fauteuil de plage, ne pas oublier l’imperméable, sandwichs au poisson sur le port.',
    'Réserver trois livres à la bibliothèque municipale, dont un livre audio.',
    'Préciser le format des carreaux, le prix de la douche, la durée des travaux, proposer une date.',
  ],
  'pt-BR': [
    'Ervas em jardineiras, tomates no lado sul. Comprar terra para plantas e um suporte para trepadeiras.',
    'Segunda macarrão, terça sopa, quarta legumes assados. Cozinhar com antecedência no domingo.',
    'Reservar uma cadeira de praia, não esquecer a capa de chuva, sanduíche de peixe no porto.',
    'Reservar três livros na biblioteca municipal, um deles em audiolivro.',
    'Definir o tamanho do piso, o preço do chuveiro, a duração da obra e sugerir uma data.',
  ],
};
const BOOKS: ByLang<string[]> = {
  de: ['Privat', 'Arbeit', 'Ideen'],
  en: ['Personal', 'Work', 'Ideas'],
  es: ['Personal', 'Trabajo', 'Ideas'],
  fr: ['Perso', 'Travail', 'Idées'],
  'pt-BR': ['Pessoal', 'Trabalho', 'Ideias'],
};
const BOOK_ICONS = ['home', 'target', 'puzzle'];
const SCRATCH: ByLang<{ title: string; body: string }> = {
  de: { title: 'Schmierzettel', body: 'Milch nicht vergessen\nPaket abholen bis Freitag' },
  en: { title: 'Scratch pad', body: 'Don’t forget milk\nPick up parcel by Friday' },
  es: { title: 'Nota rápida', body: 'No olvidar la leche\nRecoger el paquete antes del viernes' },
  fr: { title: 'Pense-bête', body: 'Ne pas oublier le lait\nRécupérer le colis avant vendredi' },
  'pt-BR': { title: 'Rascunho', body: 'Não esquecer o leite\nBuscar a encomenda até sexta' },
};

/** Pages that show the formatting: checklist, table, highlight, link, headings, list, quote, code. */
const FORMATTED: ByLang<{ plan: [string, string]; guide: [string, string] }> = {
  de: {
    plan: [
      'Beispiel: Wochenplan mit Checkliste',
      '## Diese Woche\n\n- [x] Einkauf erledigt\n- [ ] Paket abholen\n- [ ] ==Steuerunterlagen sortieren==\n\n| Tag | Plan |\n| --- | --- |\n| Mo | Sport |\n| Mi | Elternabend |\n\nMehr dazu: [[%LINK%]]',
    ],
    guide: [
      'Beispiel: Formatierung',
      "# Überschrift 1\n\n## Überschrift 2\n\n**Fett**, *kursiv*, ~~durchgestrichen~~ und `Code`.\n\n1. Erster Schritt\n2. Zweiter Schritt\n\n> Ein Zitat zum Merken.\n\n```ts\nconst gruss = 'Hallo';\n```",
    ],
  },
  en: {
    plan: [
      'Example: weekly plan with checklist',
      '## This week\n\n- [x] Groceries done\n- [ ] Pick up parcel\n- [ ] ==Sort tax papers==\n\n| Day | Plan |\n| --- | --- |\n| Mon | Sport |\n| Wed | Parents’ evening |\n\nMore: [[%LINK%]]',
    ],
    guide: [
      'Example: formatting',
      "# Heading 1\n\n## Heading 2\n\n**Bold**, *italic*, ~~strikethrough~~ and `code`.\n\n1. First step\n2. Second step\n\n> A quote to remember.\n\n```ts\nconst greeting = 'Hello';\n```",
    ],
  },
  es: {
    plan: [
      'Ejemplo: plan semanal con lista',
      '## Esta semana\n\n- [x] Compra hecha\n- [ ] Recoger el paquete\n- [ ] ==Ordenar los papeles de impuestos==\n\n| Día | Plan |\n| --- | --- |\n| Lun | Deporte |\n| Mié | Reunión de padres |\n\nMás: [[%LINK%]]',
    ],
    guide: [
      'Ejemplo: formato',
      "# Título 1\n\n## Título 2\n\n**Negrita**, *cursiva*, ~~tachado~~ y `código`.\n\n1. Primer paso\n2. Segundo paso\n\n> Una cita para recordar.\n\n```ts\nconst saludo = 'Hola';\n```",
    ],
  },
  fr: {
    plan: [
      'Exemple : plan de la semaine avec liste',
      '## Cette semaine\n\n- [x] Courses faites\n- [ ] Récupérer le colis\n- [ ] ==Trier les papiers d’impôts==\n\n| Jour | Plan |\n| --- | --- |\n| Lun | Sport |\n| Mer | Réunion de parents |\n\nPlus : [[%LINK%]]',
    ],
    guide: [
      'Exemple : mise en forme',
      "# Titre 1\n\n## Titre 2\n\n**Gras**, *italique*, ~~barré~~ et `code`.\n\n1. Première étape\n2. Deuxième étape\n\n> Une citation à retenir.\n\n```ts\nconst salut = 'Bonjour';\n```",
    ],
  },
  'pt-BR': {
    plan: [
      'Exemplo: plano da semana com lista',
      '## Esta semana\n\n- [x] Compras feitas\n- [ ] Buscar a encomenda\n- [ ] ==Organizar os papéis do imposto==\n\n| Dia | Plano |\n| --- | --- |\n| Seg | Esporte |\n| Qua | Reunião de pais |\n\nMais: [[%LINK%]]',
    ],
    guide: [
      'Exemplo: formatação',
      "# Título 1\n\n## Título 2\n\n**Negrito**, *itálico*, ~~tachado~~ e `código`.\n\n1. Primeiro passo\n2. Segundo passo\n\n> Uma citação para lembrar.\n\n```ts\nconst ola = 'Olá';\n```",
    ],
  },
};

function seed(ctx: SeedContext): SeedRows {
  const titles = TITLES[ctx.lang];
  const bodies = BODIES[ctx.lang];
  const scratch = SCRATCH[ctx.lang];
  const n = ctx.count({ small: 4, medium: 10, large: 200, xl: 2000 });
  const books = BOOKS[ctx.lang];
  const bookId = (i: number) => ctx.id('notes', 'notebook', i);
  const formatted = FORMATTED[ctx.lang];
  const link = titles[6]!; // the recipe page: the example links to it
  const showcase = [formatted.plan, formatted.guide].map(([title, body], k) => ({
    id: ctx.id('notes', 'note', n + k),
    data: {
      title,
      body: body.replace('%LINK%', link),
      pinned: false,
      notebookId: bookId(k === 0 ? 0 : 2),
      order: (n + k + 1) * 10,
    },
  }));
  return {
    notebook: books.map((name, i) => ({
      id: bookId(i),
      data: { name, tone: i + 1, icon: BOOK_ICONS[i]!, order: (i + 1) * 10 },
    })),
    note: [
      // The fixed scratch pad (see logic.ts SCRATCH_ID).
      {
        id: 'scratch',
        data: {
          title: scratch.title,
          body: scratch.body,
          pinned: true,
          notebookId: null,
          order: 0,
        },
      },
      ...Array.from({ length: n }, (_, i) => ({
        id: ctx.id('notes', 'note', i),
        data: {
          title: i < titles.length ? titles[i]! : `${ctx.rng.pick(titles)} (${i})`,
          body: ctx.rng.pick(bodies),
          pinned: i < 2,
          // Every fourth page stays in "Allgemein"; the rest spread over the three notebooks.
          notebookId: i % 4 === 3 ? null : bookId(i % 3),
          order: (i + 1) * 10,
        },
      })),
      ...showcase,
    ],
  };
}

export default { seed } satisfies SeedModule;
