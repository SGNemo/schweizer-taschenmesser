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
  // A really empty app (no setup state, no data) is a fresh installation: it gets the calm defaults. Read before
  // anything is awaited: the page renders alongside and may write its first settings while the browser answers.
  const fresh = !(await readSetupState()) && !(await appHasData());
  // Everything that depends on "fresh" comes before the setup state: a first start that ends after it (the app is
  // closed at once) must not let the next start read its own setup state as an existing installation. For a fresh
  // app both steps write only `_meta` markers, which `appHasData` does not count, so the setup state decides as before.
  await applyDefaultsEra(fresh, (view) => useUiStore.getState().setHomeView(view));
  // The same fresh installation notes its default set of modules (device-local, never a synced row).
  await markFreshDefaults(fresh);
  // Decides `dismissed` (installation with data) vs `notStarted` before any module work writes.
  await ensureSetupState();
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best effort only.
  }
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
