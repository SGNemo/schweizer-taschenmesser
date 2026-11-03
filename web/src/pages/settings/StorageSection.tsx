import { useEffect, useState } from 'react';
import { useModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import {
  attachmentStats,
  cacheEntries,
  clearRuntimeCache,
  formatBytes,
  moduleEntryCounts,
  readUsage,
  type ModuleCount,
  type StorageUsage,
} from '@/core/settings/storageInfo';
import { useUiStore } from '@/stores/ui';
import { tSettings4 } from '@/strings.settings4';
import { Button, SettingRow, SettingsGroup } from '@/ui';
import settingsStyles from './settings.module.css';

/**
 * Settings → Allgemein → Daten → "Speicher": what the app holds on this device. Read-only except the
 * cache (files the app can fetch again); the modules' data is never deleted from here.
 */
export function StorageSection() {
  const s = tSettings4.use().storage;
  const toast = useUiStore((st) => st.toast);
  const states = useModuleStates();
  const [usage, setUsage] = useState<StorageUsage>();
  const [counts, setCounts] = useState<ModuleCount[]>();
  const [files, setFiles] = useState<{ files: number; bytes: number }>();
  const [cache, setCache] = useState<number | undefined | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void readUsage().then(setUsage);
    void attachmentStats().then(setFiles);
    void cacheEntries().then(setCache);
  }, []);
  useEffect(() => {
    if (!states) return;
    const active = new Set(Object.keys(states).filter((id) => states[id]));
    void moduleEntryCounts(availableManifests(), active).then(setCounts);
  }, [states]);

  const size =
    usage?.used === undefined
      ? s.unknown
      : usage.quota
        ? s.usedOf(formatBytes(usage.used), formatBytes(usage.quota))
        : s.used(formatBytes(usage.used));

  return (
    <SettingsGroup id="storage" title={s.title} description={s.description}>
      <SettingRow id="storage--used" label={size}>
        {usage?.persisted === undefined ? null : (
          <span className={settingsStyles.muted}>
            {usage.persisted ? s.persisted : s.notPersisted}
          </span>
        )}
      </SettingRow>
      <SettingRow id="storage--modules" label={s.modulesTitle} stacked>
        {counts && counts.length === 0 ? (
          <p className={settingsStyles.muted}>{s.noData}</p>
        ) : (
          <ul data-testid="storage-modules">
            {(counts ?? []).map((c) => (
              <li key={c.id}>
                {c.name}: {s.entries(c.entries)}
              </li>
            ))}
          </ul>
        )}
      </SettingRow>
      <SettingRow
        id="storage--attachments"
        label={s.attachmentsTitle}
        description={
          files && files.files > 0
            ? s.attachments(files.files, formatBytes(files.bytes))
            : s.attachmentsNone
        }
      />
      {cache === undefined ? null : (
        <SettingRow
          id="storage--cache"
          label={s.cacheTitle}
          description={`${s.cacheDescription} ${cache ? s.cacheEntries(cache) : s.cacheNone}`}
          stacked
        >
          {cache ? (
            confirm ? (
              <div className={settingsStyles.form} role="group" aria-label={s.cacheClear}>
                <p>{s.cacheConfirm}</p>
                <span className={settingsStyles.row}>
                  <Button
                    variant="primary"
                    data-testid="cache-clear-yes"
                    onClick={() =>
                      void clearRuntimeCache().then((n) => {
                        setConfirm(false);
                        setCache(0);
                        toast(s.cacheCleared(n));
                      })
                    }
                  >
                    {s.cacheConfirmYes}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirm(false)}>
                    {s.cacheCancel}
                  </Button>
                </span>
              </div>
            ) : (
              <Button onClick={() => setConfirm(true)} data-testid="cache-clear">
                {s.cacheClear}
              </Button>
            )
          ) : null}
        </SettingRow>
      )}
    </SettingsGroup>
  );
}
