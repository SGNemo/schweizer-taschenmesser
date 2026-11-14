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

const FORM_ID = 'backup-export-form';

/** State and parts of the form; the settings lay them out inline, the dialog puts the buttons into its footer. */
function useBackupExport(inDialog: boolean, onSaved?: () => void) {
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

  const fields = (
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
    </>
  );
  const actions = (
    <>
      {/* In the dialog the encrypted export submits the form: Enter or the phone's "Go" key in the password field. */}
      <Button
        variant={inDialog ? 'primary' : 'secondary'}
        disabled={busy}
        {...(inDialog
          ? { type: 'submit' as const, form: FORM_ID }
          : { onClick: () => void exportEncrypted() })}
      >
        {t.backup.encryptedExport}
      </Button>
      <Button disabled={busy} onClick={() => void exportPlain()}>
        {inDialog ? t.backup.exportPlain : t.backup.export}
      </Button>
    </>
  );
  return { fields, actions, exportEncrypted };
}

/**
 * "Backup herunterladen" as one form: the password recommendation, the password field, "Verschlüsselt exportieren"
 * and the readable file as the second choice. Settings → Sync & Backup and the Gerätestatus dialog show this same
 * form, so the recommendation is worded once and a readable file is never one click from a status page.
 * Settings keep both buttons secondary: their filled action is "Verbinden".
 */
export function BackupExportForm() {
  const { fields, actions } = useBackupExport(false);
  return (
    <>
      {fields}
      <div className={styles.actions}>{actions}</div>
      <p className={styles.muted}>{t.backup.plainHint}</p>
    </>
  );
}

/**
 * The same form in a dialog (Gerätestatus), titled "Backup sichern": the encrypted export is the filled action, the
 * password field takes the focus, the readable file says "Ohne Passwort herunterladen" (the opener's own words on it
 * would invite the wrong click), and the buttons sit in the footer, above the phone's keyboard. Closes after a saved file.
 */
export function BackupExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Every opening starts empty (no password kept from the last one); the dialog itself stays mounted while it
  // closes, so the native close hands the focus back to the button.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return <ExportDialog key={session} open={open} onClose={onClose} />;
}

function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { fields, actions, exportEncrypted } = useBackupExport(true, onClose);
  return (
    <Dialog open={open} onClose={onClose} title={t.backup.exportTitle} footer={actions}>
      <form
        id={FORM_ID}
        className={styles.form}
        data-testid="backup-export-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void exportEncrypted();
        }}
      >
        {fields}
        <p className={styles.muted}>{t.backup.plainHint}</p>
      </form>
    </Dialog>
  );
}
