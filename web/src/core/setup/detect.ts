/** "Does this app hold anything yet?" – read-only; decides the migration and the welcome card. */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { readTransaction } from '@/core/db/tx';
import { allManifests } from '@/core/modules/registry';
import type { ModuleManifest } from '@/core/modules/types';
import { initialState, readSetupState, SETUP_STATE_KEY, type SetupState } from './state';

const SECRET_KEYS = ['syncConfig', 'aiConfig'];

export async function appHasData(
  database: TaschenmesserDB = defaultDb,
  manifests: readonly ModuleManifest[] = allManifests,
): Promise<boolean> {
  const collections = manifests.flatMap((m) =>
    Object.entries(m.dataSchema.collections)
      // Caches (e.g. news articles) say nothing about user data.
      .filter(([, def]) => !def.local)
      .map(([collection]) => tableName(m.id, collection)),
  );
  const general = ['_modules', '_settings', '_imports'];
  // One read transaction: a page that writes its own default (the to-do list) while the app starts
  // waits for it, so it never makes a fresh installation look like one with data.
  return readTransaction(database, [...general, '_secrets', ...collections], async () => {
    for (const name of [...general, ...collections]) {
      if ((await database.table(name).count()) > 0) return true;
    }
    for (const key of SECRET_KEYS) {
      if (await database.table('_secrets').get(key)) return true;
    }
    return false;
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
  await database.table('_meta').put({ key: SETUP_STATE_KEY, value: state });
  return state;
}
