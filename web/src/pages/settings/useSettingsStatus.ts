import { useEffect, useState } from 'react';
import { useAiOn } from '@/core/ai/switch';
import { isEntryUsable, useAiConfig } from '@/core/ai/config';
import { useUsageRows } from '@/core/ai/usage';
import { loadLastBackup, type LastBackup } from '@/core/backup/lastBackup';
import { formatNumber, formatTimestamp } from '@/core/i18n/format';
import { useModuleStates } from '@/core/modules/activation';
import { getPlatform } from '@/core/platform';
import { categoryDef } from '@/core/settings/registry/categories';
import { settingsPath } from '@/core/settings/registry/paths';
import { useSyncStatus } from '@/core/sync/status';
import { now } from '@/core/time/now';
import { useUpdateStore } from '@/core/update/controller';
import { loadAccountsSettings } from '@/modules/accounts/autolock';
import { useSession } from '@/modules/accounts/session';
import { tSettings2 } from '@/strings.settings2';
import { tSettingsV3 } from '@/strings.settingsV3';
import type { IconName } from '@/ui';

export interface StatusTile {
  id: 'security' | 'sync' | 'backup' | 'updates' | 'ai' | 'storage';
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
   *  phone leaves it out (U55). */
  generic?: boolean;
  testId: string;
}

/**
 * The six states of the status head: security, sync, backup, updates, AI, storage. The data is the one the
 * overview cards showed before (same hooks, same texts); only the place changed.
 */
export function useSettingsStatus(): StatusTile[] {
  const o = tSettings2.use().overview;
  const v3 = tSettingsV3.use();

  const states = useModuleStates();
  const vaultOn = states?.accounts === true;
  const session = useSession((s) => s.session);
  const [minutes, setMinutes] = useState<string>();
  const [last, setLast] = useState<LastBackup>();
  useEffect(() => {
    // The reads finish later; an unmounted head (or a finished test) must not get the state update.
    let live = true;
    void loadLastBackup().then((v) => live && setLast(v));
    if (vaultOn) void loadAccountsSettings().then((s) => live && setMinutes(s.autoLockMinutes));
    return () => {
      live = false;
    };
  }, [vaultOn]);

  const sync = useSyncStatus();
  const syncStatus =
    sync.phase === 'off'
      ? o.sync.off
      : sync.phase === 'syncing'
        ? o.sync.syncing
        : sync.phase === 'error'
          ? o.sync.error
          : o.sync.on;
  const syncContext =
    sync.phase === 'off'
      ? o.sync.offContext
      : [
          sync.lastSyncAt ? o.sync.lastAt(formatTimestamp(sync.lastSyncAt)) : o.sync.never,
          sync.serverStats ? o.sync.devices(sync.serverStats.devices) : undefined,
        ]
          .filter(Boolean)
          .join(' · ');

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

  const aiOn = useAiOn();
  const config = useAiConfig();
  const rows = useUsageRows();
  const providers = config ? config.providers.filter(isEntryUsable).length : 0;
  const since = new Date(now()).setHours(0, 0, 0, 0);
  const tokens = (rows ?? [])
    .filter((r) => r.at >= since)
    .reduce((n, r) => n + r.inputTokens + r.outputTokens, 0);
  const aiStatus = !aiOn ? o.ai.off : providers === 0 ? o.ai.none : o.ai.providers(providers);
  const aiContext =
    !aiOn || providers === 0
      ? categoryDef('ki').description
      : tokens > 0
        ? o.ai.tokensToday(formatNumber(tokens))
        : o.ai.noTokens;

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

  return [
    {
      id: 'security',
      // With the vault off the category does not exist: the module list is where it is switched on.
      to: vaultOn ? '/settings/sicherheit' : '/settings/module',
      icon: 'lock',
      title: v3.tiles.security,
      status: !vaultOn
        ? o.security.noVault
        : session.status === 'locked'
          ? o.security.locked
          : o.security.unlocked,
      context:
        vaultOn && minutes ? o.security.autoLock(minutes) : categoryDef('sicherheit').description,
      generic: !(vaultOn && minutes),
      attention: false,
      testId: 'overview-security',
    },
    {
      id: 'sync',
      to: '/settings/sync',
      icon: 'sync',
      title: v3.tiles.sync,
      status: syncStatus,
      context: syncContext,
      generic: sync.phase === 'off',
      attention: sync.phase === 'error',
      testId: 'overview-sync',
    },
    {
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
    },
    {
      id: 'updates',
      to: '/settings/updates',
      icon: 'download',
      title: v3.tiles.updates,
      status: available ? o.updates.available : o.updates.current,
      context: version ? o.updates.version(version) : categoryDef('updates').description,
      generic: !version,
      attention: available,
      testId: 'overview-updates',
    },
    {
      id: 'ai',
      to: '/settings/ki',
      icon: 'sparkles',
      title: v3.tiles.ai,
      status: aiStatus,
      context: aiContext,
      generic: !aiOn || providers === 0,
      attention: false,
      testId: 'overview-ai',
    },
    {
      id: 'storage',
      to: settingsPath('allgemein', 'recently-deleted'),
      icon: 'disk',
      title: v3.tiles.storage,
      status: used ? o.storage.used(size) : o.storage.unknown,
      context: o.storage.context,
      generic: true,
      attention: false,
      testId: 'overview-storage',
    },
  ];
}
