/**
 * What the app holds on this device: the browser's usage figure, entries per module, attachments and
 * the runtime cache. Read-only except for the cache, which only ever holds files the app can fetch
 * again (`LAZY_CACHE`: tools, chat, dictionaries); the data of the modules is never touched from here.
 * The vault is not counted (as in the diagnostics: not even its size).
 */
import { db } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { numberFormat } from '@/core/i18n/format';
import type { ModuleManifest } from '@/core/modules/types';
import { LAZY_CACHE } from '@/pwa/lazyCache';

/** Modules whose entries are never listed. */
const NO_COUNTS: ReadonlySet<string> = new Set(['accounts']);

export interface StorageUsage {
  used?: number;
  quota?: number;
  /** Does the browser promise not to drop the data when space runs short? `undefined` = cannot tell. */
  persisted?: boolean;
}

export async function readUsage(
  storage: Pick<StorageManager, 'estimate' | 'persisted'> | undefined = typeof navigator ===
  'undefined'
    ? undefined
    : navigator.storage,
): Promise<StorageUsage> {
  const out: StorageUsage = {};
  try {
    const e = await storage?.estimate?.();
    if (e?.usage !== undefined) out.used = e.usage;
    if (e?.quota !== undefined) out.quota = e.quota;
    out.persisted = await storage?.persisted?.();
  } catch {
    // a browser without the API: nothing to show
  }
  return out;
}

export interface ModuleCount {
  id: string;
  name: string;
  entries: number;
}

/** Entries (not deleted) per active module, most first; zero-entry modules are left out. */
export async function moduleEntryCounts(
  manifests: readonly ModuleManifest[],
  active: ReadonlySet<string>,
): Promise<ModuleCount[]> {
  const out: ModuleCount[] = [];
  for (const m of manifests) {
    if (!active.has(m.id) || NO_COUNTS.has(m.id)) continue;
    let entries = 0;
    for (const c of Object.keys(m.dataSchema.collections)) {
      try {
        entries += await db
          .table(tableName(m.id, c))
          .filter((r: { deletedAt?: unknown }) => !r.deletedAt)
          .count();
      } catch {
        // a table that cannot be read counts as 0
      }
    }
    if (entries > 0) out.push({ id: m.id, name: m.name, entries });
  }
  return out.sort((a, b) => b.entries - a.entries);
}

/** Attachments (`_blobs`): how many files and how many bytes. */
export async function attachmentStats(): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  try {
    await db.table<{ data?: ArrayBuffer }>('_blobs').each((r) => {
      files++;
      bytes += r.data?.byteLength ?? 0;
    });
  } catch {
    // no table in this context
  }
  return { files, bytes };
}

/** Files in the runtime cache, or `undefined` where there is no Cache API. */
export async function cacheEntries(
  storage: Pick<CacheStorage, 'has' | 'open'> | undefined = typeof caches === 'undefined'
    ? undefined
    : caches,
): Promise<number | undefined> {
  if (!storage) return undefined;
  try {
    if (!(await storage.has(LAZY_CACHE))) return 0;
    return (await (await storage.open(LAZY_CACHE)).keys()).length;
  } catch {
    return undefined;
  }
}

/** Empties the runtime cache (never the precache of the app itself); returns how many files went. */
export async function clearRuntimeCache(
  storage: Pick<CacheStorage, 'has' | 'open' | 'delete'> | undefined = typeof caches === 'undefined'
    ? undefined
    : caches,
): Promise<number> {
  const n = (await cacheEntries(storage)) ?? 0;
  if (storage && n > 0) await storage.delete(LAZY_CACHE);
  return n;
}

/** "1,5 MB" in the current format. */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${numberFormat({ maximumFractionDigits: v < 10 && i > 0 ? 1 : 0 }).format(v)} ${units[i]}`;
}
