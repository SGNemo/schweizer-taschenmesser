import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { bus, type DataPolicy } from '@/core/events';
import { runMigrations } from './migrate';
import { visibleManifests } from './registry';
import type { ModuleManifest } from './types';

const moduleStateSchema = z.object({
  enabled: z.boolean(),
  /** What happened to the data when the module was last disabled. */
  dataPolicy: z.enum(['keep', 'delete']).nullable(),
});

function stateRepo(database: TaschenmesserDB = defaultDb) {
  return createRepo('_modules', moduleStateSchema, database);
}

export type ModuleStates = Record<string, boolean>;

/** Explicit user choice wins; otherwise the manifest default applies. */
export async function loadModuleStates(
  manifests: readonly ModuleManifest[] = visibleManifests,
  database: TaschenmesserDB = defaultDb,
): Promise<ModuleStates> {
  const rows = await stateRepo(database).active().toArray();
  return resolveStates(manifests, rows);
}

export function resolveStates(
  manifests: readonly ModuleManifest[],
  rows: { id: string; enabled: boolean }[],
): ModuleStates {
  const byId = new Map(rows.map((r) => [r.id, r.enabled]));
  return Object.fromEntries(manifests.map((m) => [m.id, byId.get(m.id) ?? m.defaultEnabled]));
}

/** Live module states; `undefined` until the first read has completed. */
export function useModuleStates(): ModuleStates | undefined {
  return useLiveQuery(() => loadModuleStates(), []);
}

export async function enableModule(
  manifest: ModuleManifest,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await stateRepo(database).upsert(manifest.id, { enabled: true, dataPolicy: null });
  await runMigrations(manifest, database);
  await bus.emit('module.enabled', { moduleId: manifest.id });
}

/** Soft-delete every record of the module (tombstones, so the deletion syncs). */
export async function wipeModuleData(
  manifest: ModuleManifest,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  for (const [collection, def] of Object.entries(manifest.dataSchema.collections)) {
    const repo = createRepo(tableName(manifest.id, collection), def.schema, database);
    await repo.removeMany((await repo.active().primaryKeys()) as string[]);
  }
}

export async function disableModule(
  manifest: ModuleManifest,
  policy: DataPolicy,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  if (policy === 'delete') await wipeModuleData(manifest, database);
  await stateRepo(database).upsert(manifest.id, { enabled: false, dataPolicy: policy });
  await bus.emit('module.disabled', { moduleId: manifest.id, policy });
}
