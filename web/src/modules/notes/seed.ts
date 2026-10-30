import type { Lang } from '@/core/i18n/lang';
import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const TITLES: Record<Lang, string[]> = {
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
const BODIES: Record<Lang, string[]> = {
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
const SCRATCH: Record<Lang, { title: string; body: string }> = {
  de: { title: 'Zettel', body: 'Milch nicht vergessen\nPaket abholen bis Freitag' },
  en: { title: 'Scratch pad', body: 'Don’t forget milk\nPick up parcel by Friday' },
  es: { title: 'Nota rápida', body: 'No olvidar la leche\nRecoger el paquete antes del viernes' },
  fr: { title: 'Pense-bête', body: 'Ne pas oublier le lait\nRécupérer le colis avant vendredi' },
  'pt-BR': { title: 'Rascunho', body: 'Não esquecer o leite\nBuscar a encomenda até sexta' },
};

function seed(ctx: SeedContext): SeedRows {
  const titles = TITLES[ctx.lang];
  const bodies = BODIES[ctx.lang];
  const scratch = SCRATCH[ctx.lang];
  const n = ctx.count({ small: 4, medium: 10, large: 200 });
  return {
    note: [
      // The fixed scratch pad (see logic.ts SCRATCH_ID).
      {
        id: 'scratch',
        data: {
          title: scratch.title,
          body: scratch.body,
          pinned: true,
        },
      },
      ...Array.from({ length: n }, (_, i) => ({
        id: ctx.id('notes', 'note', i),
        data: {
          title: i < titles.length ? titles[i]! : `${ctx.rng.pick(titles)} (${i})`,
          body: ctx.rng.pick(bodies),
          pinned: i < 2,
        },
      })),
    ],
  };
}

export default { seed } satisfies SeedModule;
