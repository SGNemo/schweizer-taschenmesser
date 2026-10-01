import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const TITLES = [
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
];
const BODIES = [
  'Kräuter in Kästen, Tomaten an die Südseite. Blumenerde und Rankhilfe besorgen.',
  'Montag Nudeln, Dienstag Suppe, Mittwoch Ofengemüse. Vorkochen am Sonntag.',
  'Strandkorb reservieren, Regenjacke nicht vergessen, Fischbrötchen in Warnemünde.',
  'Drei Bücher aus der Stadtbibliothek vormerken, eins davon als Hörbuch.',
  'Fliesenformat klären, Preis für die Dusche, Dauer der Arbeiten, Terminvorschlag.',
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 4, medium: 10, large: 200 });
  return {
    note: Array.from({ length: n }, (_, i) => ({
      id: ctx.id('notes', 'note', i),
      data: {
        title: i < TITLES.length ? TITLES[i]! : `${ctx.rng.pick(TITLES)} (${i})`,
        body: ctx.rng.pick(BODIES),
        pinned: i < 2,
      },
    })),
  };
}

export default { seed } satisfies SeedModule;
