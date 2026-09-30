import { loadModuleStates } from '@/core/modules/activation';
import { runMigrations } from '@/core/modules/migrate';
import { availableManifests } from '@/core/modules/available';
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
  const states = await loadModuleStates();
  for (const m of availableManifests()) {
    if (states[m.id]) await runMigrations(m);
  }
}
