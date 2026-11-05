import type { AfterSeedContext, SeedContext, SeedModule, SeedRows } from '@/core/seed/types';
import { getPlannerSettings } from './prefs';
import { assignmentRepo, itemKeyOf, itemRepo } from './repo';
import { resumeRuns, runBackground, suspendRuns } from './services';

/**
 * Test data of the planner (contract: docs/howto/seed-data.md). Days the user touched (available
 * time, a day off, two blockers) and planning facts on ToDos of the todos seed (`dependsOn`): one
 * pinned, one with a hard due, one long and splittable, one that stays out. Assignments are not
 * seeded: the service computes them from these inputs on the first run (deterministic anyway).
 * The ToDo without an estimate („Keller aufräumen“, index 3 of the todos seed) shows „~30 Min“.
 */
const WEEKDAY_DEFAULT = 240;

function seed(ctx: SeedContext): SeedRows {
  const span = ctx.count({ small: 7, medium: 7, large: 28 });
  const task = (i: number) => itemKeyOf('todos', ctx.id('todos', 'task', i));
  const day = (
    offset: number,
    availableMin: number | undefined,
    blockers: { label: string; min: number }[] = [],
  ) => ({
    id: ctx.day(offset),
    data: {
      date: ctx.day(offset),
      ...(availableMin !== undefined ? { availableMin } : {}),
      blockers: blockers.map((b, i) => ({
        id: `seed-blocker-${offset}-${i}`,
        label: b.label,
        min: b.min,
      })),
    },
  });
  const days = [
    day(0, 180),
    day(1, undefined, [
      {
        label: ctx.text({
          de: 'Werkstatt',
          en: 'Workshop',
          es: 'Taller',
          fr: 'Atelier',
          'pt-BR': 'Oficina',
        }),
        min: 60,
      },
    ]),
    day(3, 0),
    ...(ctx.scale === 'small'
      ? []
      : [
          day(2, 300),
          day(4, WEEKDAY_DEFAULT, [
            {
              label: ctx.text({
                de: 'Elternabend',
                en: 'Parents’ evening',
                es: 'Reunión de padres',
                fr: 'Réunion de parents',
                'pt-BR': 'Reunião de pais',
              }),
              min: 90,
            },
          ]),
        ]),
    ...Array.from({ length: Math.max(0, span - 7) }, (_, i) =>
      day(7 + i, ctx.rng.chance(0.2) ? 0 : WEEKDAY_DEFAULT + ctx.rng.int(-2, 2) * 30),
    ),
  ];
  const items = [
    // Pinned to the day after tomorrow: „Präsentation proben“.
    {
      id: task(7),
      data: {
        source: { module: 'todos', id: ctx.id('todos', 'task', 7) },
        pinned: ctx.day(2),
        order: 0,
      },
    },
    // A hard due: „Reisekosten abrechnen“ must be done by tomorrow.
    {
      id: task(8),
      data: {
        source: { module: 'todos', id: ctx.id('todos', 'task', 8) },
        due: { date: ctx.day(1), hard: true },
        order: 1,
      },
    },
    // Long and splittable: „Keller aufräumen“ (no estimate on the ToDo; the planner knows better).
    {
      id: task(3),
      data: {
        source: { module: 'todos', id: ctx.id('todos', 'task', 3) },
        durationMin: 180,
        splittable: true,
        order: 2,
      },
    },
    // Out of the plan on purpose: „Glühbirne im Flur wechseln“.
    {
      id: task(2),
      data: {
        source: { module: 'todos', id: ctx.id('todos', 'task', 2) },
        excluded: true,
        order: 3,
      },
    },
  ];
  return { day: days, item: items };
}

/**
 * The first run over the test data, inside the seed: the rows for the todos seed's tasks are test data
 * too (registered, gone with „entfernen“). Rows and marks of a person's own things stay theirs – only
 * rows whose thing is a registered seed task are returned.
 */
async function afterSeed(ctx: AfterSeedContext): Promise<{ collection: string; ids: string[] }[]> {
  // Automatic planning switched off: the test data gets no run either (a run would also touch the
  // person's own things); rows a later planner action makes for seed tasks are a known dev-data edge.
  if (!(await getPlannerSettings()).autoReplan) return [];
  const seedKeys = new Set((await ctx.seeded('todos', 'task')).map((id) => itemKeyOf('todos', id)));
  await runBackground({ force: true });
  // Every row of a seed task – also one the service's own run wrote before this hook (re-registering is harmless).
  const items = (await itemRepo.active().toArray())
    .filter((r) => seedKeys.has(r.id))
    .map((r) => r.id);
  const assignments = (await assignmentRepo.active().toArray())
    .filter((r) => seedKeys.has(r.itemKey))
    .map((r) => r.id);
  return [
    { collection: 'item', ids: items },
    { collection: 'assignment', ids: assignments },
  ];
}

/** Removal deletes the todos and the rows table by table: no run may write meanwhile. */
const beforeRemove = (): Promise<void> => suspendRuns();
const afterRemove = async (): Promise<void> => resumeRuns();

export default { seed, afterSeed, beforeRemove, afterRemove } satisfies SeedModule;
