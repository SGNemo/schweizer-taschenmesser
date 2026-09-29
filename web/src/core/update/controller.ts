/**
 * Update flow of the installed app: check (throttled), offer, back up, install. All platform
 * specifics live behind `PlatformService.updater`; this file is plain, testable logic plus a small
 * zustand store the banner and the settings page read.
 */
import { create } from 'zustand';
import type { TaschenmesserDB } from '@/core/db/db';
import { getPlatform, type PlatformService } from '@/core/platform';
import { now as clockNow } from '@/core/time/now';
import { createPreUpdateBackup } from './backup';
import {
  getDismissedVersion,
  getLastCheckAt,
  loadPrefs,
  setDismissedVersion,
  setLastCheckAt,
} from './prefs';
import type { InstallProgress, UpdateInfo } from './types';

/** Automatic checks run at most once per day. */
export const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type UpdateErrorCode =
  | 'check-failed'
  | 'backup-failed'
  | 'install-failed'
  | 'folder-not-writable'
  | 'signature-invalid';

/** The Rust side prefixes its errors with a code (`folder-not-writable: …`); everything else is generic. */
export function installErrorCode(e: unknown): UpdateErrorCode {
  const text = e instanceof Error ? e.message : String(e);
  if (text.startsWith('folder-not-writable')) return 'folder-not-writable';
  if (text.startsWith('signature-invalid')) return 'signature-invalid';
  return 'install-failed';
}

export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'up-to-date'; checkedAt: number }
  | { phase: 'available'; info: UpdateInfo }
  | {
      phase: 'installing';
      info: UpdateInfo;
      step: 'backup' | 'download' | 'handover';
      progress?: InstallProgress;
    }
  | { phase: 'needs-permission'; info: UpdateInfo }
  | { phase: 'error'; code: UpdateErrorCode; info?: UpdateInfo };

export const useUpdateStore = create<{ state: UpdateState; set: (s: UpdateState) => void }>(
  (set) => ({
    state: { phase: 'idle' },
    set: (state) => set({ state }),
  }),
);

export interface UpdateDeps {
  platform: Pick<PlatformService, 'updater' | 'app'>;
  database?: TaschenmesserDB;
  now(): number;
  /** Writes the pre-update backup; replaced in tests. */
  backup(from: string, to: string): Promise<unknown>;
  setState(state: UpdateState): void;
}

export const defaultUpdateDeps = (): UpdateDeps => ({
  platform: getPlatform(),
  now: clockNow,
  backup: createPreUpdateBackup,
  setState: (s) => useUpdateStore.getState().set(s),
});

/**
 * Looks for an update. Automatic checks (`manual: false`) respect the preference and the daily
 * throttle, stay silent on failure and do not re-offer a version the user postponed; a manual check
 * always runs and reports its outcome.
 */
export async function checkForUpdate(
  opts: { manual: boolean },
  deps: UpdateDeps = defaultUpdateDeps(),
): Promise<UpdateState> {
  const { updater } = deps.platform;
  if (!updater.supported) return { phase: 'idle' };
  const prefs = await loadPrefs(deps.database);
  if (!opts.manual) {
    if (!prefs.auto) return { phase: 'idle' };
    const last = await getLastCheckAt(deps.database);
    if (last !== undefined && deps.now() - last < AUTO_CHECK_INTERVAL_MS) return { phase: 'idle' };
  }

  deps.setState({ phase: 'checking' });
  let result: UpdateState;
  try {
    const info = await updater.check(prefs.channel, await deps.platform.app.version());
    await setLastCheckAt(deps.now(), deps.database);
    if (!info) result = { phase: 'up-to-date', checkedAt: deps.now() };
    else if (!opts.manual && (await getDismissedVersion(deps.database)) === info.version) {
      result = { phase: 'idle' };
    } else result = { phase: 'available', info };
  } catch (e) {
    console.warn('[update] check failed', e);
    result = opts.manual ? { phase: 'error', code: 'check-failed' } : { phase: 'idle' };
  }
  deps.setState(result);
  return result;
}

/** "Später": hide the offer and do not bring this version up again automatically. */
export async function postponeUpdate(
  info: UpdateInfo,
  deps: UpdateDeps = defaultUpdateDeps(),
): Promise<void> {
  await setDismissedVersion(info.version, deps.database);
  deps.setState({ phase: 'idle' });
}

/**
 * Backs up the local data, then installs. The backup is mandatory: when it cannot be written the
 * update is not started.
 */
export async function installUpdate(
  info: UpdateInfo,
  deps: UpdateDeps = defaultUpdateDeps(),
): Promise<UpdateState> {
  let step: 'backup' | 'download' | 'handover' = 'backup';
  deps.setState({ phase: 'installing', info, step });
  const current = await deps.platform.app.version();
  try {
    await deps.backup(current, info.version);
  } catch (e) {
    console.warn('[update] pre-update backup failed', e);
    const failed: UpdateState = { phase: 'error', code: 'backup-failed', info };
    deps.setState(failed);
    return failed;
  }
  try {
    step = 'download';
    deps.setState({ phase: 'installing', info, step });
    const outcome = await deps.platform.updater.install(info, (progress) =>
      deps.setState({ phase: 'installing', info, step: 'download', progress }),
    );
    const next: UpdateState =
      outcome === 'needs-permission'
        ? { phase: 'needs-permission', info }
        : { phase: 'installing', info, step: 'handover' };
    deps.setState(next);
    return next;
  } catch (e) {
    console.warn('[update] install failed', e);
    const failed: UpdateState = { phase: 'error', code: installErrorCode(e), info };
    deps.setState(failed);
    return failed;
  }
}

/** Automatic check at start and whenever the app returns to the foreground (throttled to once a day). */
export function startUpdateChecks(deps: UpdateDeps = defaultUpdateDeps()): () => void {
  if (!deps.platform.updater.supported) return () => undefined;
  const run = () => void checkForUpdate({ manual: false }, deps);
  const onVisible = () => {
    if (document.visibilityState === 'visible') run();
  };
  run();
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
