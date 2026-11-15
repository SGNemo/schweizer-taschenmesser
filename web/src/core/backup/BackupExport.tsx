import { useEffect, useId, useRef, useState } from 'react';
import { t } from '@/strings';
import { useSecurityPrefs } from '@/core/security/prefs';
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

/** State and parts of the form; the settings lay them out inline, the dialog puts the buttons into its footer. */
function useBackupExport(dialog?: { open: boolean; formId: string; onSaved: () => void }) {
  const inDialog = dialog !== undefined;
  // "Nur verschlüsselte Backups" (Einstellungen → Sicherheit): the readable file is not offered at all.
  const { encryptedOnly } = useSecurityPrefs();
  const toast = useUiStore((s) => s.toast);
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | undefined>();
  // Which export runs: its button says "Wird gesichert …" (encrypting a large backup takes a moment).
  const [busy, setBusy] = useState<'encrypted' | 'plain' | undefined>();
  // A closed dialog keeps no password in memory.
  if (dialog && !dialog.open && (pass || error)) {
    setPass('');
    setError(undefined);
  }
  // A save that ends after its dialog was replaced by a new opening must not close the new one.
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );

  async function saved(message: string) {
    await recordFileBackup().catch(() => undefined); // only the status lines read it
    toast(message);
    if (live.current) dialog?.onSaved();
  }

  async function exportPlain() {
    setError(undefined);
    setBusy('plain');
    try {
      const result = await downloadTextFile(
        backupFileName(),
        await serializeSealedBackup(await createBackup(), { readable: true }),
      );
      if (result === 'saved') await saved(t.backup.exported);
    } catch {
      // A calm line in the form instead of a silent failure; the details never reach the screen.
      if (live.current) setError(t.backup.exportFailed);
    } finally {
      setBusy(undefined);
    }
  }

  async function exportEncrypted() {
    setError(undefined);
    if (pass.length < MIN_BACKUP_PASSPHRASE_LENGTH) return setError(t.backup.passphraseTooShort);
    setBusy('encrypted');
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
    } catch {
      if (live.current) setError(t.backup.exportFailed);
    } finally {
      setBusy(undefined);
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
        disabled={busy !== undefined}
        {...(inDialog
          ? { type: 'submit' as const, form: dialog.formId }
          : { onClick: () => void exportEncrypted() })}
      >
        {busy === 'encrypted' ? t.backup.exporting : t.backup.encryptedExport}
      </Button>
      {encryptedOnly ? null : (
        <Button disabled={busy !== undefined} onClick={() => void exportPlain()}>
          {busy === 'plain'
            ? t.backup.exporting
            : inDialog
              ? t.backup.exportPlain
              : t.backup.export}
        </Button>
      )}
    </>
  );
  const plainHint = encryptedOnly ? null : <p className={styles.muted}>{t.backup.plainHint}</p>;
  return { fields, actions, exportEncrypted, plainHint };
}

/**
 * "Backup herunterladen" as one form: the password recommendation, the password field, "Verschlüsselt exportieren"
 * and the readable file as the second choice. Settings → Sync & Backup and the Gerätestatus dialog show this same
 * form, so the recommendation is worded once and a readable file is never one click from a status page.
 * Settings keep both buttons secondary: their filled action is "Verbinden".
 */
export function BackupExportForm() {
  const { fields, actions, plainHint } = useBackupExport();
  return (
    <>
      {fields}
      <div className={styles.actions}>{actions}</div>
      {plainHint}
    </>
  );
}

/**
 * The same form in a dialog (Gerätestatus), titled "Backup sichern": the encrypted export is the filled action, the
 * password field takes the focus, the readable file says "Ohne Passwort herunterladen" (the opener's own words on it
 * would invite the wrong click), and the buttons sit in the footer, above the phone's keyboard. Closes after a saved file.
 */
export function BackupExportDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a file was saved, before the dialog closes. */
  onSaved?: () => void;
}) {
  // Every opening is a new form (a late save of the last one cannot close it); the dialog itself stays mounted while
  // it closes, so the native close hands the focus back to the button.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return <ExportDialog key={session} open={open} onClose={onClose} onSaved={onSaved} />;
}

function ExportDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const formId = useId();
  const { fields, actions, exportEncrypted, plainHint } = useBackupExport({
    open,
    formId,
    onSaved: () => {
      onSaved?.();
      onClose();
    },
  });
  return (
    <Dialog open={open} onClose={onClose} title={t.backup.exportTitle} footer={actions}>
      <form
        id={formId}
        className={styles.form}
        data-testid="backup-export-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void exportEncrypted();
        }}
      >
        {fields}
        {plainHint}
      </form>
    </Dialog>
  );
}
