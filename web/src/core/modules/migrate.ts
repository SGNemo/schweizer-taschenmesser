import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import type { ModuleContext, ModuleManifest } from './types';

const versionKey = (id: string) => `moduleVersion.${id}`;

/**
 * Runs pending data migrations. The installed version is device-local (`_meta`), because
 * every device migrates its own copy of the data; field-level LWW keeps the results convergent.
 * A module seen for the first time is considered current (nothing to migrate).
 */
export async function runMigrations(
  manifest: ModuleManifest,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const meta = database.table<{ key: string; value: number }, string>('_meta');
  const row = await meta.get(versionKey(manifest.id));
  const installed = row?.value ?? manifest.version;

  const pending = Object.keys(manifest.migrations)
    .map(Number)
    .filter((v) => v > installed && v <= manifest.version)
    .sort((a, b) => a - b);

  const ctx: ModuleContext = {
    moduleId: manifest.id,
    async forEachRecord(collection, fn) {
      const def = manifest.dataSchema.collections[collection];
      if (!def) throw new Error(`Unknown collection "${collection}" in module "${manifest.id}"`);
      const repo = createRepo(tableName(manifest.id, collection), def.schema, database);
      for (const rec of await repo.active().toArray()) {
        const patch = fn(rec as unknown as Record<string, unknown>);
        if (patch) await repo.update(rec.id, patch);
      }
    },
  };

  for (const v of pending) await manifest.migrations[v]!(ctx);
  if (row?.value !== manifest.version) {
    await meta.put({ key: versionKey(manifest.id), value: manifest.version });
  }
}
