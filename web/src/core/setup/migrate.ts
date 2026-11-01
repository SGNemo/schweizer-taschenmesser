/**
 * "Umzug von einer anderen App": which origins the person chose and what is still missing for
 * each. Device-local (`_meta`, key `migrate.state`, never synced): origin ids, item ids and the
 * time of choosing only – never file names, entries or contents.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { rwTransaction } from '@/core/db/tx';
import { batchStatus } from '@/core/importer/batches';
import type { ImportBatch } from '@/core/importer/types';
import { now } from '@/core/time/now';

export const MIGRATE_STEP_ID = 'core.migrate';
export const MIGRATE_STATE_KEY = 'migrate.state';

export const ORIGINS = ['google', 'todoist', 'obsidian', 'bank', 'bitwarden', 'paper'] as const;
export type Origin = (typeof ORIGINS)[number];

export interface MigrateItemDef {
  id: string;
  origin: Origin;
  /** Done as soon as an import batch of this module exists (committed after the origin was chosen). */
  moduleId?: string;
  /** Ticked by hand: nothing in the app can see it (vault import, calendar subscription). */
  manual?: boolean;
}

/** The open points per origin. "paper" has none: nothing to bring along. */
export const MIGRATE_ITEMS: readonly MigrateItemDef[] = [
  { id: 'google.calendar', origin: 'google', moduleId: 'calendar' },
  { id: 'google.tasks', origin: 'google', moduleId: 'todos' },
  { id: 'google.keep', origin: 'google', moduleId: 'notes' },
  { id: 'google.subscription', origin: 'google', manual: true },
  { id: 'todoist.tasks', origin: 'todoist', moduleId: 'todos' },
  { id: 'obsidian.notes', origin: 'obsidian', moduleId: 'notes' },
  { id: 'bank.statement', origin: 'bank', moduleId: 'finance' },
  { id: 'bitwarden.vault', origin: 'bitwarden', manual: true },
];

export const migrateStateSchema = z.strictObject({
  /** Origin id → time it was chosen. */
  origins: z.record(z.string(), z.number()),
  /** Ids of manual items that were ticked. */
  manualDone: z.array(z.string()),
});
export type MigrateState = z.infer<typeof migrateStateSchema>;

export const EMPTY_MIGRATE: MigrateState = { origins: {}, manualDone: [] };

export interface MigrateItemStatus {
  id: string;
  origin: Origin;
  manual: boolean;
  done: boolean;
}

const isOrigin = (id: string): id is Origin => (ORIGINS as readonly string[]).includes(id);

/** Origins in the fixed tile order. */
export function chosenOrigins(state: MigrateState): Origin[] {
  return ORIGINS.filter((o) => o in state.origins);
}

/** Has the person chosen anything at all (a tile)? */
export const hasMigrateChoice = (state: MigrateState): boolean => chosenOrigins(state).length > 0;

/**
 * Pure: the open points of the chosen origins. An import point is done when a committed batch of
 * its module was made after the origin was chosen; a manual one when it was ticked.
 */
export function migrateItems(
  state: MigrateState,
  batches: readonly Pick<
    ImportBatch,
    'moduleId' | 'createdAt' | 'committedAt' | 'status' | 'undoneAt'
  >[],
  defs: readonly MigrateItemDef[] = MIGRATE_ITEMS,
): MigrateItemStatus[] {
  const committed = batches.filter((b) => batchStatus(b as ImportBatch) === 'committed');
  return defs
    .filter((d) => d.origin in state.origins)
    .map((d) => {
      const since = state.origins[d.origin]!;
      const done = d.manual
        ? state.manualDone.includes(d.id)
        : committed.some(
            (b) => b.moduleId === d.moduleId && (b.committedAt ?? b.createdAt) >= since,
          );
      return { id: d.id, origin: d.origin, manual: !!d.manual, done };
    });
}

/**
 * What "Weiter" means in the step: done when something was chosen and nothing is left to do for
 * a chosen import ("paper" alone counts: that is an answer too); otherwise "Später".
 */
export function migrateOutcome(
  state: MigrateState,
  items: readonly MigrateItemStatus[],
): 'done' | 'skipped' {
  if (!hasMigrateChoice(state)) return 'skipped';
  const imports = items.filter((i) => !i.manual);
  if (imports.length === 0) return 'done'; // paper / vault only
  return imports.some((i) => i.done) ? 'done' : 'skipped';
}

/* ---- storage ---- */

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function readMigrateState(
  database: TaschenmesserDB = defaultDb,
): Promise<MigrateState> {
  const parsed = migrateStateSchema.safeParse((await meta(database).get(MIGRATE_STATE_KEY))?.value);
  if (!parsed.success) return EMPTY_MIGRATE;
  const origins = Object.fromEntries(
    Object.entries(parsed.data.origins).filter(([k]) => isOrigin(k)),
  );
  return {
    origins,
    manualDone: parsed.data.manualDone.filter((id) => MIGRATE_ITEMS.some((d) => d.id === id)),
  };
}

async function update(
  change: (s: MigrateState) => MigrateState,
  database: TaschenmesserDB,
): Promise<MigrateState> {
  const table = meta(database);
  return rwTransaction(database, [table], async () => {
    const next = migrateStateSchema.parse(change(await readMigrateState(database)));
    await table.put({ key: MIGRATE_STATE_KEY, value: next });
    return next;
  });
}

/** Remembers the origin (first choice wins, so the time stays the first one). */
export const chooseOrigin = (origin: Origin, database: TaschenmesserDB = defaultDb) =>
  update(
    (s) => (origin in s.origins ? s : { ...s, origins: { ...s.origins, [origin]: now() } }),
    database,
  );

export const setManualDone = (id: string, done: boolean, database: TaschenmesserDB = defaultDb) =>
  update(
    (s) => ({
      ...s,
      manualDone: done
        ? s.manualDone.includes(id)
          ? s.manualDone
          : [...s.manualDone, id]
        : s.manualDone.filter((x) => x !== id),
    }),
    database,
  );

export interface MigrateOverview {
  state: MigrateState;
  items: MigrateItemStatus[];
}

export async function readMigrateOverview(
  database: TaschenmesserDB = defaultDb,
): Promise<MigrateOverview> {
  const state = await readMigrateState(database);
  const modules = [...new Set(MIGRATE_ITEMS.flatMap((d) => (d.moduleId ? [d.moduleId] : [])))];
  const batches = await database
    .table<ImportBatch, string>('_imports')
    .where('moduleId')
    .anyOf(modules)
    .toArray();
  return { state, items: migrateItems(state, batches) };
}

/** Live overview; `undefined` while loading. */
export function useMigrateOverview(): MigrateOverview | undefined {
  return useLiveQuery(() => readMigrateOverview(), []);
}

/**
 * Is this installation still empty (no module holds entries of the person's own)? The step is
 * offered only then – or when the person already chose an origin, so its open points stay reachable.
 */
export async function installationIsEmpty(): Promise<boolean> {
  const { availableManifests } = await import('@/core/modules/available');
  const { moduleHasEntries } = await import('@/core/modules/activation');
  const { SELF_FILLED } = await import('@/core/importer/StartDataButton');
  for (const m of availableManifests())
    if (await moduleHasEntries(m, SELF_FILLED[m.id] ?? [])) return false;
  return true;
}

export async function migrateStepApplies(): Promise<boolean> {
  return hasMigrateChoice(await readMigrateState()) || (await installationIsEmpty());
}
