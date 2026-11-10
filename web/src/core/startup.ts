import { runAppMigrations } from '@/core/db/appMigrations';
import { loadModuleStates } from '@/core/modules/activation';
import { runMigrations } from '@/core/modules/migrate';
import { availableManifests } from '@/core/modules/available';
import { applyDefaultsEra } from '@/core/focus/defaults';
import { markFreshDefaults } from '@/core/modules/defaults';
import { appHasData, ensureSetupState } from '@/core/setup/detect';
import { readSetupState } from '@/core/setup/state';
import { startAutomation } from '@/core/automation/start';
import { startHistory } from '@/core/settings/history';
import { startProfileScheduler } from '@/core/settings/profiles';
import { useUiStore } from '@/stores/ui';

let stopHistory: (() => void) | undefined;
let stopScheduler: (() => void) | undefined;
let stopAutomation: (() => void) | undefined;

/** One-time app start work: storage persistence and pending module migrations. */
export async function initCore(): Promise<void> {
  // The change history listens from the very start, so a change made while the app is still waking up counts too.
  if (!stopHistory && typeof localStorage !== 'undefined') stopHistory = startHistory();
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort only.
  }
  // A really empty app (no setup state, no data) is a fresh installation: it gets the calm defaults.
  const fresh = !(await readSetupState()) && !(await appHasData());
  // First: decides `dismissed` (installation with data) vs `notStarted` before anything writes.
  await ensureSetupState();
  await applyDefaultsEra(fresh, (view) => useUiStore.getState().setHomeView(view));
  // The same fresh installation notes its default set of modules (device-local, never a synced row).
  await markFreshDefaults(fresh);
  // Dev-Preview: an empty app is no longer filled by itself; the welcome card offers
  // "Mit Testdaten ansehen" next to "Einrichtung starten" (A10, round 5), so a tester sees the setup.
  const states = await loadModuleStates();
  for (const m of availableManifests()) {
    if (states[m.id]) await runMigrations(m);
  }
  // Forward copies between merged/retired modules (also run after every sync pull and restore).
  await runAppMigrations();
  // Profile schedules run once the data is ready, while the app is open.
  if (!stopScheduler && typeof localStorage !== 'undefined')
    stopScheduler = startProfileScheduler();
  // Rules (off until switched on in Settings): watch writes, schedule triggers, module checks.
  if (!stopAutomation && typeof document !== 'undefined') stopAutomation = startAutomation();
}
