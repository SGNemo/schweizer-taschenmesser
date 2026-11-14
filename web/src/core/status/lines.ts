/**
 * The state of this device as lines: sync, backup, updates, storage. One source for every place that shows it: the
 * status lines of the settings start page and the page of the module "Gerätestatus" read these hooks, so a line never
 * says one thing here and another there. (The page's head also counts the page's own lines, so it can name a point
 * the settings line, which speaks for these four, does not.) A line carries a word for the state, one calm context
 * line and a link to where the thing is set; never a server address, a token, a key, a path or an IP, and nothing
 * here switches anything.
 *
 * A line whose first read has not come back carries `loading` (its words are not the state yet, so "Kein Backup" never
 * stands there before the last backup is read): a list shows its lines once none of them loads (`useSettled`), so they
 * appear together instead of one by one.
 */
import { useEffect, useState } from 'react';
import { loadLastBackup, type LastBackup } from '@/core/backup/lastBackup';
import { formatNumber, formatTimestamp } from '@/core/i18n/format';
import { getPlatform } from '@/core/platform';
import { categoryDef } from '@/core/settings/registry/categories';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSyncStatus } from '@/core/sync/status';
import { useUpdateStore } from '@/core/update/controller';
import { tSettings2 } from '@/strings.settings2';
import { tSettingsV3 } from '@/strings.settingsV3';
import type { IconName } from '@/ui';

export interface StatusLine {
  id: string;
  to: string;
  icon: IconName;
  title: string;
  /** The state in one line. */
  status: string;
  /** What the state means, in one calm line (every number has one). */
  context: string;
  /** `true` = something needs a look (a plain marker, never red). */
  attention: boolean;
  /** `true` = the context line only explains the state or the category (no date, number or setting of its own): the
   *  settings head leaves it out on the phone (U55). */
  generic?: boolean;
  /** `true` while the line's first read has not come back: its words are not the state yet (empty, or a fallback). */
  loading?: boolean;
  testId: string;
}

/**
 * The value of one read per mount, and whether it came back (`done` also when it failed: a failed read keeps the
 * line's fallback words, it never holds a list back). No read (`undefined`: not on this platform) = done at once.
 */
export function useRead<T>(read: (() => Promise<T>) | undefined): {
  value: T | undefined;
  done: boolean;
} {
  const on = read !== undefined;
  const [state, setState] = useState<{ value: T | undefined; done: boolean }>({
    value: undefined,
    done: !on,
  });
  useEffect(() => {
    if (!read) return;
    // The read finishes later; an unmounted view (or a finished test) must not get the state update.
    let live = true;
    void read().then(
      (value) => live && setState({ value, done: true }),
      () => live && setState({ value: undefined, done: true }),
    );
    return () => {
      live = false;
    };
    // The readers are stable per platform; only "exists here" can differ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return state;
}

// The bound of a first read lives in `./settled` (light, also for pages that wait for one read before they paint).
export { STATUS_WAIT_MS, useSettled } from './settled';

/** `true` while a line of the list still loads. */
export const anyLoading = (lines: readonly (StatusLine | undefined)[]): boolean =>
  lines.some((l) => l?.loading === true);

export function useSyncLine(): StatusLine {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();
  const sync = useSyncStatus();
  const status =
    sync.phase === 'off'
      ? o.sync.off
      : sync.phase === 'syncing'
        ? o.sync.syncing
        : sync.phase === 'error'
          ? o.sync.error
          : o.sync.on;
  const context =
    sync.phase === 'off'
      ? o.sync.offContext
      : [
          sync.lastSyncAt ? o.sync.lastAt(formatTimestamp(sync.lastSyncAt)) : o.sync.never,
          sync.serverStats ? o.sync.devices(sync.serverStats.devices) : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
  return {
    id: 'sync',
    to: '/settings/sync',
    icon: 'sync',
    title: v3.tiles.sync,
    status,
    context,
    generic: sync.phase === 'off',
    attention: sync.phase === 'error',
    testId: 'overview-sync',
  };
}

export function useBackupLine(): StatusLine {
  const v3 = tSettingsV3.use();
  // `undefined` after the read = this device has no backup yet; before it, the line says nothing.
  const { value: last, done } = useRead<LastBackup | undefined>(loadLastBackup);
  const base = {
    id: 'backup',
    to: settingsPath('sync', 'backup'),
    icon: 'cloud',
    title: v3.tiles.backup,
    testId: 'overview-backup',
  } as const;
  if (!done) return { ...base, status: '', context: '', attention: false, loading: true };
  return {
    ...base,
    status: !last ? v3.backup.none : last.ok ? v3.backup.done : v3.backup.failed,
    context: !last
      ? v3.backup.noneContext
      : last.ok
        ? (last.kind === 'file' ? v3.backup.fileAt : v3.backup.at)(formatTimestamp(last.at))
        : v3.backup.tried(formatTimestamp(last.at)),
    generic: !last,
    attention: last?.ok === false,
  };
}

export function useUpdatesLine(): StatusLine {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();
  const available = useUpdateStore((u) => u.state.phase === 'available');
  const { value: version, done } = useRead(() => getPlatform().app.version());
  return {
    id: 'updates',
    to: '/settings/updates',
    icon: 'download',
    title: v3.tiles.updates,
    status: available ? o.updates.available : o.updates.current,
    context: version ? o.updates.version(version) : categoryDef('updates').description,
    generic: !version,
    attention: available,
    // The state word is known at once; only the context waits for the version (the list waits for it too).
    loading: !done || undefined,
    testId: 'overview-updates',
  };
}

/** What Nemo's own data takes on this device (the browser's estimate; a size, never a path). */
export function useStorageLine(): StatusLine {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();
  const estimate =
    typeof navigator !== 'undefined' && navigator.storage?.estimate
      ? () => navigator.storage.estimate()
      : undefined;
  const { value, done } = useRead(estimate);
  const used = value?.usage;
  const mb = used ? used / (1024 * 1024) : 0;
  const size = `${formatNumber(mb, { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return {
    id: 'storage',
    to: settingsPath('allgemein', 'recently-deleted'),
    icon: 'disk',
    title: v3.tiles.storage,
    status: used ? o.storage.used(size) : o.storage.unknown,
    context: o.storage.context,
    generic: true,
    attention: false,
    loading: !done || undefined,
    testId: 'overview-storage',
  };
}

/** The four lines of this device, in the order the settings show them. */
export function useDeviceLines(): {
  sync: StatusLine;
  backup: StatusLine;
  updates: StatusLine;
  storage: StatusLine;
} {
  return {
    sync: useSyncLine(),
    backup: useBackupLine(),
    updates: useUpdatesLine(),
    storage: useStorageLine(),
  };
}
