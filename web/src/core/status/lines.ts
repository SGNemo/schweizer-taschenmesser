/**
 * The state of this device as lines: sync, backup, updates, storage. One source for every place that shows it: the
 * status lines of the settings start page and the page of the module "Gerätestatus" read these hooks, so the two can
 * never disagree. A line carries a word for the state, one calm context line and a link to where the thing is set;
 * never a server address, a token, a key, a path or an IP, and nothing here switches anything.
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
  testId: string;
}

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

/** The newest backup of this device (`undefined` while it loads and where there is none). */
export function useLastBackup(): LastBackup | undefined {
  const [last, setLast] = useState<LastBackup>();
  useEffect(() => {
    // The read finishes later; an unmounted view (or a finished test) must not get the state update.
    let live = true;
    void loadLastBackup().then((v) => live && setLast(v));
    return () => {
      live = false;
    };
  }, []);
  return last;
}

export function useBackupLine(): StatusLine {
  const v3 = tSettingsV3.use();
  const last = useLastBackup();
  return {
    id: 'backup',
    to: settingsPath('sync', 'backup'),
    icon: 'cloud',
    title: v3.tiles.backup,
    status: !last ? v3.backup.none : last.ok ? v3.backup.done : v3.backup.failed,
    context: !last
      ? v3.backup.noneContext
      : last.ok
        ? (last.kind === 'file' ? v3.backup.fileAt : v3.backup.at)(formatTimestamp(last.at))
        : v3.backup.tried(formatTimestamp(last.at)),
    generic: !last,
    attention: last?.ok === false,
    testId: 'overview-backup',
  };
}

export function useUpdatesLine(): StatusLine {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();
  const available = useUpdateStore((u) => u.state.phase === 'available');
  const [version, setVersion] = useState('');
  useEffect(() => {
    let live = true;
    void getPlatform()
      .app.version()
      .then((v) => live && setVersion(v));
    return () => {
      live = false;
    };
  }, []);
  return {
    id: 'updates',
    to: '/settings/updates',
    icon: 'download',
    title: v3.tiles.updates,
    status: available ? o.updates.available : o.updates.current,
    context: version ? o.updates.version(version) : categoryDef('updates').description,
    generic: !version,
    attention: available,
    testId: 'overview-updates',
  };
}

/** What Nemo's own data takes on this device (the browser's estimate; a size, never a path). */
export function useStorageLine(): StatusLine {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();
  const [used, setUsed] = useState<number | null>();
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
    let live = true;
    void navigator.storage.estimate().then(
      (e) => live && setUsed(e.usage ?? null),
      () => live && setUsed(null),
    );
    return () => {
      live = false;
    };
  }, []);
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
