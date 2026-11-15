/** "Does this app hold anything yet?" – decides the migration, the welcome card and the calm first-start defaults. */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { readTransaction, rwTransaction } from '@/core/db/tx';
import { allManifests } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { initialState, readSetupState, SETUP_STATE_KEY, type SetupState } from './state';

const SECRET_KEYS = ['syncConfig', 'aiConfig'];
const GENERAL = ['_modules', '_settings', '_imports'];

/** Device-local answer to "is this a fresh installation?", noted at the first start until the setup state is stored. */
export const FRESH_START_KEY = 'start.fresh';

function dataTables(manifests: readonly ModuleManifest[]): string[] {
  const collections = manifests.flatMap((m) =>
    Object.entries(m.dataSchema.collections)
      // Caches (e.g. news articles) say nothing about user data.
      .filter(([, def]) => !def.local)
      .map(([collection]) => tableName(m.id, collection)),
  );
  return [...GENERAL, ...collections];
}

/** Only Dexie reads: runs inside the caller's transaction over `_secrets` and `tables`. */
async function holdsData(database: TaschenmesserDB, tables: string[]): Promise<boolean> {
  for (const name of tables) {
    if ((await database.table(name).count()) > 0) return true;
  }
  for (const key of SECRET_KEYS) {
    if (await database.table('_secrets').get(key)) return true;
  }
  return false;
}

export async function appHasData(
  database: TaschenmesserDB = defaultDb,
  manifests: readonly ModuleManifest[] = allManifests,
): Promise<boolean> {
  const tables = dataTables(manifests);
  // One read transaction: a write that starts meanwhile waits until the answer is read.
  return readTransaction(database, [...tables, '_secrets'], () => holdsData(database, tables));
}

/**
 * "Fresh installation?" (no setup state, no data), decided once and noted in `_meta` in the same
 * transaction, so neither a write that follows nor a start that ends early (the app closed or
 * reloaded before the setup state is stored) changes the answer for the next start. Called before
 * the first render; once the setup state exists it decides (an existing installation: `false`).
 */
export async function decideFreshStart(
  database: TaschenmesserDB = defaultDb,
  manifests: readonly ModuleManifest[] = allManifests,
): Promise<boolean> {
  const tables = dataTables(manifests);
  const meta = database.table<{ key: string; value: unknown }, string>('_meta');
  return rwTransaction(database, ['_meta', '_secrets', ...tables], async () => {
    if (await readSetupState(database)) return false;
    const noted = (await meta.get(FRESH_START_KEY))?.value;
    if (typeof noted === 'boolean') return noted;
    const fresh = !(await holdsData(database, tables));
    await meta.put({ key: FRESH_START_KEY, value: fresh });
    return fresh;
  });
}

/**
 * One-time migration at start. Existing installations (anything stored) become `dismissed`, so the
 * assistant never appears by itself there; a really empty app is `notStarted`. Idempotent.
 */
export async function ensureSetupState(
  database: TaschenmesserDB = defaultDb,
  manifests: readonly ModuleManifest[] = allManifests,
  /** What the start already read (before any page could write its own defaults). */
  knownHasData?: boolean,
): Promise<SetupState> {
  const existing = await readSetupState(database);
  if (existing) return existing;
  const hasData = knownHasData ?? (await appHasData(database, manifests));
  // An existing installation never sees the assistant by itself: dismissed, and no checklist card
  // until the user switches it on in the settings.
  const state = hasData
    ? { ...initialState('dismissed'), checklistHidden: true }
    : initialState('notStarted');
  // The noted first-start answer has done its job once the setup state exists: an app whose setup state is
  // lost later is judged by its data again.
  const meta = database.table('_meta');
  await rwTransaction(database, [meta], async () => {
    await meta.put({ key: SETUP_STATE_KEY, value: state });
    await meta.delete(FRESH_START_KEY);
  });
  return state;
}
