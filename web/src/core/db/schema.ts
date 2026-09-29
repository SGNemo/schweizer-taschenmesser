import type { ModuleManifest } from '@/core/modules/types';

/** System tables. `synced` ones use the record envelope and travel through sync. */
export const SYSTEM_TABLES = {
  _meta: { stores: 'key', synced: false },
  _outbox: { stores: '[collection+id], queuedAt', synced: false },
  _secrets: { stores: 'key', synced: false },
  /** Assistant: validated structured queries by question (never results). */
  _aiCache: { stores: 'key, createdAt', synced: false },
  /** Assistant: one row per model call or cache hit (token accounting). */
  _aiUsage: { stores: '++id, at', synced: false },
  _settings: { stores: 'id, updatedAt', synced: true },
  _modules: { stores: 'id, updatedAt', synced: true },
} as const;

export type SystemTableName = keyof typeof SYSTEM_TABLES;

const ID_RE = /^[a-z][a-z0-9]*$/;
const COLLECTION_RE = /^[a-z][a-zA-Z0-9]*$/;

export function tableName(moduleId: string, collection: string): string {
  return `${moduleId}_${collection}`;
}

/** Derive Dexie `stores()` definitions from module manifests (plus system tables). */
export function buildStores(manifests: readonly ModuleManifest[]): Record<string, string> {
  const stores: Record<string, string> = {};
  for (const [name, def] of Object.entries(SYSTEM_TABLES)) stores[name] = def.stores;
  for (const m of manifests) {
    if (!ID_RE.test(m.id)) throw new Error(`Invalid module id "${m.id}"`);
    for (const [collection, def] of Object.entries(m.dataSchema.collections)) {
      if (!COLLECTION_RE.test(collection)) {
        throw new Error(`Invalid collection name "${collection}" in module "${m.id}"`);
      }
      const indexes = [...new Set(['id', 'updatedAt', ...def.indexes])];
      stores[tableName(m.id, collection)] = indexes.join(', ');
    }
  }
  // Stable key order → stable snapshot.
  return Object.fromEntries(Object.entries(stores).sort(([a], [b]) => a.localeCompare(b)));
}

/** Tables whose records travel through sync (module collections plus the synced system tables). */
export function syncedTableNames(manifests: readonly ModuleManifest[]): string[] {
  return Object.keys(buildStores(manifests)).filter((name) => {
    const system = SYSTEM_TABLES[name as SystemTableName];
    return system ? system.synced : true;
  });
}
