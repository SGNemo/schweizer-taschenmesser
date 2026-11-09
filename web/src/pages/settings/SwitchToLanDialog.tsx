import { useEffect, useState } from 'react';
import { backupFileName, createBackup } from '@/core/backup/backup';
import { serializeSealedBackup } from '@/core/backup/encrypted';
import { downloadTextFile } from '@/core/backup/download';
import { recordFileBackup } from '@/core/backup/lastBackup';
import { disconnect, fetchDevices, lockDevice } from '@/core/sync/service';
import type { DeviceInfo } from '@/core/sync/types';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { Button, Dialog } from '@/ui';
import { Step } from './ConnectParts';
import styles from './settings.module.css';

/**
 * "Vom Server auf das Heimnetz umstellen" (CONCEPT §7): ① a backup first (required) ② the devices the
 * server still knows – they keep syncing there until they switch too, each can be locked on the
 * server ③ disconnect from the server (local data stays). Pairing with the PC is the next step on
 * the sync page as usual; nothing merges the two worlds automatically.
 */
export function SwitchToLanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const l = tLanSync.use();
  const [saved, setSaved] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[] | undefined>();
  const [locked, setLocked] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new opening starts clean (adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSaved(false);
      setLocked(new Set());
      setFailed(false);
      setDevices(undefined);
    }
  }

  useEffect(() => {
    if (!open) return;
    let live = true;
    void fetchDevices()
      .catch(() => undefined)
      .then((list) => {
        if (live) setDevices(list?.filter((d) => !d.current && d.revokedAt === null) ?? []);
      });
    return () => {
      live = false;
    };
  }, [open]);

  async function saveBackup() {
    setFailed(false);
    const result = await downloadTextFile(
      backupFileName(),
      await serializeSealedBackup(await createBackup(), { readable: true }),
    ).catch(() => 'failed' as const);
    if (result === 'saved') {
      setSaved(true);
      await recordFileBackup().catch(() => undefined);
    }
  }

  async function lock(id: string) {
    setFailed(false);
    const ok = await lockDevice(id).catch(() => false);
    if (ok) setLocked((s) => new Set(s).add(id));
    else setFailed(true);
  }

  async function leaveServer() {
    setBusy(true);
    try {
      await disconnect();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={l.switchTitle}
      footer={
        <>
          <Button onClick={onClose}>{t.actions.cancel}</Button>
          <Button
            variant="primary"
            onClick={() => void leaveServer()}
            disabled={!saved || busy}
            data-testid="lan-switch-disconnect"
          >
            {l.switchDisconnect}
          </Button>
        </>
      }
    >
      <div className={styles.form} data-testid="lan-switch">
        <Step title={l.switchBackupTitle} hint={l.switchBackupHint}>
          {saved ? (
            <p role="status" data-testid="lan-switch-saved">
              {l.switchBackupSaved}
            </p>
          ) : (
            <Button onClick={() => void saveBackup()} data-testid="lan-switch-backup">
              {l.switchBackupSave}
            </Button>
          )}
        </Step>
        <Step title={l.switchDevicesTitle}>
          {devices === undefined ? null : devices.length === 0 ? (
            <p className={styles.muted}>{l.switchNoDevices}</p>
          ) : (
            <>
              <p className={styles.muted}>{l.switchDevicesStay}</p>
              <ul className={styles.plainList} data-testid="lan-switch-devices">
                {devices.map((d) => (
                  <li key={d.id} className={styles.row}>
                    <span>{d.name}</span>
                    {locked.has(d.id) ? (
                      <span className={styles.muted}>{l.switchLocked}</span>
                    ) : (
                      <Button onClick={() => void lock(d.id)}>{l.switchLock}</Button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {failed ? (
            <p role="status" className={styles.muted}>
              {l.switchLockFailed}
            </p>
          ) : null}
        </Step>
        <p className={styles.muted}>{saved ? l.switchThen : l.switchNeedBackup}</p>
      </div>
    </Dialog>
  );
}
