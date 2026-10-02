import { runAppMigrations } from '@/core/db/appMigrations';
import { loadModuleStates } from '@/core/modules/activation';
import { runMigrations } from '@/core/modules/migrate';
import { availableManifests } from '@/core/modules/available';
import { loadSeed } from '@/core/seed/load';
import { ensureSetupState } from '@/core/setup/detect';

/** One-time app start work: storage persistence and pending module migrations. */
export async function initCore(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort only.
  }
  // First: decides `dismissed` (installation with data) vs `notStarted` before anything writes.
  await ensureSetupState();
  // Dev-Preview only (`loadSeed` is undefined in stable builds): fill a really empty app once.
  try {
    await (await loadSeed?.())?.autoFillIfEmpty();
  } catch {
    // Test data is a convenience; the app must start without it.
  }
  const states = await loadModuleStates();
  for (const m of availableManifests()) {
    if (states[m.id]) await runMigrations(m);
  }
  // Forward copies between merged/retired modules (also run after every sync pull and restore).
  await runAppMigrations();
}
