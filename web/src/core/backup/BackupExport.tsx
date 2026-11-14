import { useState } from 'react';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, TextField } from '@/ui';
import { backupFileName, createBackup } from './backup';
import { downloadTextFile } from './download';
import {
  MIN_BACKUP_PASSPHRASE_LENGTH,
  encryptBackup,
  encryptedBackupFileName,
  serializeEncryptedBackup,
  serializeSealedBackup,
} from './encrypted';
import { recordFileBackup } from './lastBackup';
import styles from './BackupExport.module.css';

/**
 * "Backup herunterladen" as one form: the password recommendation, the password field, "Verschlüsselt exportieren"
 * and the readable file as the second choice. Settings → Sync & Backup and the Gerätestatus dialog show this same
 * form, so the recommendation is worded once and a readable file is never one click from a status page.
 */
export function BackupExportForm({
  inDialog = false,
  onSaved,
}: {
  /** In the dialog the encrypted export is the filled action, the password field takes the focus and the readable
   *  file says "without password" (the dialog is opened by "Backup herunterladen"; the same words on the readable
   *  file would invite the wrong click). Settings keep both secondary: their filled action is "Verbinden". */
  inDialog?: boolean;
  /** Called after a file was saved (not when the save dialog was cancelled). */
  onSaved?: () => void;
}) {
  const toast = useUiStore((s) => s.toast);
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function saved(message: string) {
    await recordFileBackup().catch(() => undefined); // only the status lines read it
    toast(message);
    onSaved?.();
  }

  async function exportPlain() {
    setBusy(true);
    try {
      const result = await downloadTextFile(
        backupFileName(),
        await serializeSealedBackup(await createBackup(), { readable: true }),
      );
      if (result === 'saved') await saved(t.backup.exported);
    } finally {
      setBusy(false);
    }
  }

  async function exportEncrypted() {
    setError(undefined);
    if (pass.length < MIN_BACKUP_PASSPHRASE_LENGTH) return setError(t.backup.passphraseTooShort);
    setBusy(true);
    try {
      const file = await encryptBackup(await createBackup(), pass);
      const result = await downloadTextFile(
        encryptedBackupFileName(),
        serializeEncryptedBackup(file),
      );
      if (result === 'saved') {
        setPass('');
        await saved(t.backup.encryptedExported);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className={styles.muted}>{t.backup.exportHint}</p>
      <p className={styles.muted}>{t.backup.filesNote}</p>
      <TextField
        label={t.backup.exportPassphrase}
        hint={t.backup.exportPassphraseHint}
        type="password"
        autoComplete="new-password"
        data-autofocus={inDialog || undefined}
        value={pass}
        onChange={(e) => setPass(e.target.value)}
      />
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button
          variant={inDialog ? 'primary' : 'secondary'}
          disabled={busy}
          onClick={() => void exportEncrypted()}
        >
          {t.backup.encryptedExport}
        </Button>
        <Button disabled={busy} onClick={() => void exportPlain()}>
          {inDialog ? t.backup.exportPlain : t.backup.export}
        </Button>
      </div>
      <p className={styles.muted}>{t.backup.plainHint}</p>
    </>
  );
}

/** The same form in a dialog (Gerätestatus): opened by a click, closes after a saved file. */
export function BackupExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={t.backup.exportTitle}>
      <div className={styles.form} data-testid="backup-export-dialog">
        <BackupExportForm inDialog onSaved={onClose} />
      </div>
    </Dialog>
  );
}
