import { useEffect, useState } from 'react';
import { fetchDevices, lockDevice, rotateThisDeviceToken } from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { TOMBSTONE_RETENTION_MS } from '@/core/sync/tombstones';
import type { DeviceInfo } from '@/core/sync/types';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Badge, Button, Dialog } from '@/ui';
import styles from './settings.module.css';

const formatWhen = (at: number) =>
  new Date(at).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' });

/** Devices registered on the sync server, with lock-out. Only shown while connected. */
export function SyncDevices() {
  const toast = useUiStore((s) => s.toast);
  // `undefined` = loading, `null` = server without device support
  const [devices, setDevices] = useState<DeviceInfo[] | null | undefined>();
  const [lock, setLock] = useState<DeviceInfo | undefined>();
  const [error, setError] = useState<string | undefined>();
  // The list is read again after every sync, so devices that joined or were locked elsewhere show up.
  const lastSyncAt = useSyncStatus((s) => s.lastSyncAt);

  useEffect(() => {
    let live = true;
    fetchDevices()
      .then((list) => live && setDevices(list ?? null))
      .catch(() => live && setDevices(null));
    return () => {
      live = false;
    };
  }, [lastSyncAt]);

  async function reload() {
    setDevices((await fetchDevices().catch(() => undefined)) ?? null);
  }

  async function confirmLock() {
    if (!lock) return;
    const target = lock;
    setLock(undefined);
    setError(undefined);
    const ok = await lockDevice(target.id).catch(() => false);
    if (ok) toast(t.sync.deviceLocked);
    else setError(t.sync.deviceLockFailed);
    await reload();
  }

  async function rotate() {
    setError(undefined);
    if (await rotateThisDeviceToken().catch(() => false)) toast(t.sync.rotated);
    else setError(t.sync.deviceLockFailed);
  }

  if (devices === undefined) return null;
  return (
    <div className={styles.form} data-testid="sync-devices">
      <p className={styles.legend}>{t.sync.devicesTitle}</p>
      {devices === null ? (
        <p className={styles.muted}>{t.sync.devicesUnsupported}</p>
      ) : (
        <>
          <p className={styles.muted}>{t.sync.devicesIntro}</p>
          {devices.map((d) => {
            const idleDays = d.lastSeenAt
              ? Math.floor((now() - d.lastSeenAt) / (24 * 3600_000))
              : undefined;
            const stale =
              d.revokedAt === null &&
              !d.current &&
              idleDays !== undefined &&
              idleDays * 24 * 3600_000 > TOMBSTONE_RETENTION_MS;
            return (
              <div key={d.id} className={styles.provider} data-testid={`device-${d.id}`}>
                <div className={styles.row}>
                  <strong>{d.name}</strong>
                  {d.current ? <Badge tone="accent">{t.sync.deviceThis}</Badge> : null}
                  {d.revokedAt !== null ? (
                    <Badge tone="neutral">{t.sync.deviceRevoked(formatWhen(d.revokedAt))}</Badge>
                  ) : null}
                </div>
                <span className={styles.muted}>{t.sync.deviceId(d.id)}</span>
                <span className={styles.muted}>
                  {t.sync.deviceLastSeen(
                    d.lastSeenAt ? formatWhen(d.lastSeenAt) : t.sync.deviceNever,
                  )}
                </span>
                {stale ? (
                  <span className={styles.error}>{t.sync.deviceStale(idleDays!)}</span>
                ) : null}
                {d.revokedAt === null ? (
                  <div className={styles.row}>
                    <Button variant="danger" onClick={() => setLock(d)}>
                      {t.sync.deviceLock}
                    </Button>
                    {d.current ? (
                      <Button onClick={() => void rotate()}>{t.sync.rotateToken}</Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      )}
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <Dialog
        open={lock !== undefined}
        onClose={() => setLock(undefined)}
        title={t.sync.deviceLockTitle(lock?.name ?? '')}
        footer={
          <>
            <Button onClick={() => setLock(undefined)}>{t.actions.cancel}</Button>
            <Button variant="danger" onClick={() => void confirmLock()}>
              {t.sync.deviceLock}
            </Button>
          </>
        }
      >
        <p>{t.sync.deviceLockText}</p>
      </Dialog>
    </div>
  );
}
