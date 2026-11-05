import { createRepo, type Repo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { deepEqual } from '@/core/db/util';
import { assignmentSchema, daySchema, itemSchema } from './schema';

export const MODULE_ID = 'planner';

export const dayRepo = createRepo(tableName(MODULE_ID, 'day'), daySchema);
export const itemRepo = createRepo(tableName(MODULE_ID, 'item'), itemSchema);
export const assignmentRepo = createRepo(tableName(MODULE_ID, 'assignment'), assignmentSchema);

/** A database other than the app's (tests run two devices side by side); the type comes from `createRepo`, never from `core/db/db`. */
export type PlannerDb = NonNullable<Parameters<typeof createRepo>[2]>;

/** The three repos bound to a database (tests run two devices side by side). */
export function plannerRepos(database?: PlannerDb) {
  if (!database) return { day: dayRepo, item: itemRepo, assignment: assignmentRepo };
  return {
    day: createRepo(tableName(MODULE_ID, 'day'), daySchema, database),
    item: createRepo(tableName(MODULE_ID, 'item'), itemSchema, database),
    assignment: createRepo(tableName(MODULE_ID, 'assignment'), assignmentSchema, database),
  };
}
export type PlannerRepos = ReturnType<typeof plannerRepos>;

/** Item key of a thing of a source: `<module>:<id>` (also the first part of every unit id). */
export const itemKeyOf = (moduleId: string, id: string): string => `${moduleId}:${id}`;

/**
 * The one way the planner writes a row with a deterministic id: a tombstoned row is restored first,
 * then `upsert` sets the data (`upsert` alone keeps `deletedAt`, which would hide a unit that returns,
 * a day touched again after a delete-policy disable, or a blocker set by a later package). Returns
 * whether anything was written.
 */
export async function putRow<T extends Record<string, unknown>>(
  repo: Repo<T>,
  id: string,
  data: T,
): Promise<boolean> {
  const existing = await repo.table.get(id);
  if (existing && existing.deletedAt !== null) await repo.restore(id);
  const current = await repo.table.get(id);
  // An unchanged row comes back as it was stored (same fields, same stamps).
  const row = await repo.upsert(id, data);
  return current === undefined || existing?.deletedAt !== null || !deepEqual(current, row);
}
