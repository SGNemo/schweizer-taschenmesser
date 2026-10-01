import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

const TITLES = [
  'Beispiel-Eintrag prüfen',
  'Vorlage kopieren',
  'Neues Modul planen',
  'Tests schreiben',
  'Dokumentation lesen',
  'Widget ausprobieren',
];

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 4, medium: 6, large: 40 });
  return {
    entry: Array.from({ length: n }, (_, i) => ({
      id: ctx.id('example', 'entry', i),
      data: {
        title: i < TITLES.length ? TITLES[i]! : `${TITLES[i % TITLES.length]!} (${i})`,
        done: i % 3 === 2,
        ...(i % 2 === 0 ? { note: 'Nur zur Demonstration.' } : {}),
      },
    })),
  };
}

export default { seed } satisfies SeedModule;
