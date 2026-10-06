/**
 * Start-up health of the local database and the recovery actions behind the recovery dialog
 * (`layout/RecoveryScreen.tsx`). Nothing here runs by itself except `checkDb`, which only reads.
 * Every destructive step is preceded by `dumpDb` (a copy of whatever is still readable).
 */
import Dexie from 'dexie';
import { db as defaultDb, type TaschenmesserDB } from './db';

/** Never part of the safety copy: device secrets and binary files. */
export const DUMP_EXCLUDED = new Set(['_secrets', '_blobs']);

export interface DbProblem {
  /** Dexie / DOM error name, e.g. `VersionError`. */
  name: string;
  message: string;
  /** Tables that exist but could not be read (the rest is fine). Empty when the open itself failed. */
  tables: string[];
}

const describe = (e: unknown): { name: string; message: string } =>
  e instanceof Error ? { name: e.name, message: e.message } : { name: 'Error', message: String(e) };

/** Opens the database and reads one row of every table. `undefined` = healthy. */
export async function checkDb(
  database: TaschenmesserDB = defaultDb,
): Promise<DbProblem | undefined> {
  try {
    if (!database.isOpen()) await database.open();
  } catch (e) {
    return { ...describe(e), tables: [] };
  }
  const bad: string[] = [];
  let first: { name: string; message: string } | undefined;
  for (const table of database.tables) {
    try {
      await table.limit(1).toArray();
    } catch (e) {
      bad.push(table.name);
      first ??= describe(e);
    }
  }
  return bad.length ? { ...first!, tables: bad } : undefined;
}

/**
 * Repairs what can be repaired: reopens the database and empties tables that cannot be read.
 * A database written by a newer app version (`VersionError`) is never touched. Returns what is
 * still wrong, `undefined` when the database is healthy now.
 */
export async function repairDb(
  database: TaschenmesserDB = defaultDb,
): Promise<DbProblem | undefined> {
  database.close();
  let problem = await checkDb(database);
  if (!problem) return undefined;
  if (problem.name === 'VersionError' || problem.tables.length === 0) return problem;
  for (const name of problem.tables) {
    try {
      await database.table(name).clear();
    } catch {
      // still unreadable: reported below
    }
  }
  problem = await checkDb(database);
  return problem;
}

type RawRows = Record<string, unknown[]>;

/** Reads every object store of the stored database with plain IndexedDB, independent of the app's schema. */
async function readRaw(name: string): Promise<{ version: number; stores: RawRows }> {
  const idb = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
  try {
    const stores: RawRows = {};
    for (const store of Array.from(idb.objectStoreNames)) {
      if (DUMP_EXCLUDED.has(store)) continue;
      try {
        stores[store] = await new Promise<unknown[]>((resolve, reject) => {
          const req = idb.transaction(store, 'readonly').objectStore(store).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } catch {
        stores[store] = []; // unreadable store: the dump says so through `unreadable`
      }
    }
    return { version: idb.version, stores };
  } finally {
    idb.close();
  }
}

export interface DumpResult {
  text: string;
  /** Rows saved / tables that had to be skipped. */
  rows: number;
  tables: number;
}

/** JSON copy of what is still readable in the stored database (for the user to keep). Contains user data: never part of diagnostics. */
export async function dumpDb(name: string = defaultDb.name): Promise<DumpResult> {
  let raw: { version: number; stores: RawRows };
  try {
    raw = await readRaw(name);
  } catch {
    raw = { version: 0, stores: {} };
  }
  const rows = Object.values(raw.stores).reduce((n, r) => n + r.length, 0);
  return {
    text: JSON.stringify(
      { format: 'nemo-broken-db-copy', version: 1, idbVersion: raw.version, tables: raw.stores },
      null,
      1,
    ),
    rows,
    tables: Object.keys(raw.stores).length,
  };
}

/** Deletes the stored database and opens a fresh, empty one. Only call after `dumpDb` was kept. */
export async function replaceWithEmptyDb(database: TaschenmesserDB = defaultDb): Promise<void> {
  database.close();
  await Dexie.delete(database.name);
  await database.open();
}
