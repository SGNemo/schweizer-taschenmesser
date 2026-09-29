import { loadModuleStates } from '@/core/modules/activation';
import { runMigrations } from '@/core/modules/migrate';
import { visibleManifests } from '@/core/modules/registry';

/** One-time app start work: storage persistence and pending module migrations. */
export async function initCore(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort only.
  }
  const states = await loadModuleStates();
  for (const m of visibleManifests) {
    if (states[m.id]) await runMigrations(m);
  }
}
