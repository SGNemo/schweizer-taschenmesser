import { runAppMigrations } from '@/core/db/appMigrations';
import { copyTodoLinksAtStart } from '@/core/entitylinks/migrate';
import { loadModuleStates } from '@/core/modules/activation';
import { runMigrations } from '@/core/modules/migrate';
import { availableManifests } from '@/core/modules/available';
import { applyDefaultsEra } from '@/core/focus/defaults';
import { markFreshDefaults } from '@/core/modules/defaults';
import { decideFreshStart, ensureSetupState } from '@/core/setup/detect';
import { startAutomation } from '@/core/automation/start';
import { startHistory } from '@/core/settings/history';
import { startScreenGuard } from '@/core/security/screen';
import { startProfileScheduler } from '@/core/settings/profiles';
import { useUiStore } from '@/stores/ui';

let stopHistory: (() => void) | undefined;
let stopScheduler: (() => void) | undefined;
let stopAutomation: (() => void) | undefined;
let stopScreenGuard: (() => void) | undefined;

/**
 * One-time app start work: storage persistence and pending module migrations. `start` is the "fresh
 * installation?" answer; `main.tsx` decides it before the first render, so nothing the page writes counts.
 */
export async function initCore(
  start: Promise<boolean> | boolean = decideFreshStart(),
): Promise<void> {
  // The change history listens from the very start, so a change made while the app is still waking up counts too.
  if (!stopHistory && typeof localStorage !== 'undefined') stopHistory = startHistory();
  // "Bildschirmschutz: überall" (Android) from the very start, before any data shows.
  if (!stopScreenGuard && typeof localStorage !== 'undefined') stopScreenGuard = startScreenGuard();
  // A really empty app (no setup state, no data) is a fresh installation: it gets the calm defaults. The answer is
  // noted in `_meta` when it is decided, so a first start closed or reloaded before the steps below keeps it.
  const fresh = await start;
  await applyDefaultsEra(fresh, (view) => useUiStore.getState().setHomeView(view));
  // The same fresh installation notes its default set of modules (device-local, never a synced row).
  await markFreshDefaults(fresh);
  // Decides `dismissed` (installation with data) vs `notStarted` before any module work writes; it takes
  // the answer decided above, as the page may have written entries (a first to-do) since.
  await ensureSetupState(undefined, undefined, !fresh);
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
  // The links a ToDo stores in its own field also become rows of the link table: at every start, whatever
  // sync does (a copy is stamped like its source, so it never beats a removal). Not awaited: start-up and
  // the background services do not wait for the scan.
  void copyTodoLinksAtStart();
  // Profile schedules run once the data is ready, while the app is open.
  if (!stopScheduler && typeof localStorage !== 'undefined')
    stopScheduler = startProfileScheduler();
  // Rules (off until switched on in Settings): watch writes, schedule triggers, module checks.
  if (!stopAutomation && typeof document !== 'undefined') stopAutomation = startAutomation();
}
