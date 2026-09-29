import { useState, type ChangeEvent } from 'react';
import {
  backupFileName,
  createBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  type Backup,
  type ImportMode,
} from '@/core/backup/backup';
import { downloadTextFile } from '@/core/backup/download';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Card, Dialog } from '@/ui';
import styles from './settings.module.css';

export function BackupSection() {
  const toast = useUiStore((s) => s.toast);
  const [backup, setBackup] = useState<Backup | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function exportNow() {
    const result = await downloadTextFile(backupFileName(), serializeBackup(await createBackup()));
    if (result === 'saved') toast(t.backup.exported);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setBackup(undefined);
    setError(undefined);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (parsed.ok) setBackup(parsed.backup);
    else setError(t.backup.errors[parsed.reason]);
  }

  async function runImport() {
    if (!backup) return;
    setConfirm(false);
    setBusy(true);
    const summary = await importBackup(backup, mode);
    setBusy(false);
    setBackup(undefined);
    toast(t.backup.done(summary.records, summary.removed));
  }

  const counts = backup
    ? t.backup.contains(
        Object.values(backup.tables).reduce((n, rows) => n + rows.length, 0),
        Object.keys(backup.tables).length,
      )
    : '';

  return (
    <Card>
      <div className={styles.form}>
        <p>{t.backup.intro}</p>
        <div className={styles.row}>
          <Button onClick={() => void exportNow()}>{t.backup.export}</Button>
        </div>

        <div>
          <label htmlFor="backup-file" className={styles.legend}>
            {t.backup.file}
          </label>
          <br />
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            className={styles.file}
            onChange={(e) => void onFile(e)}
          />
        </div>
        {error ? (
          <p role="alert" className={styles.error} data-testid="backup-error">
            {error}
          </p>
        ) : null}

        {backup ? (
          <>
            <p data-testid="backup-contents">{counts}</p>
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>{t.backup.mode}</legend>
              {(['merge', 'replace'] as const).map((m) => (
                <label key={m} className={styles.choice}>
                  <input
                    type="radio"
                    name="backup-mode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  <span>
                    {t.backup[m]}
                    <br />
                    <span className={styles.muted}>{t.backup[`${m}Hint`]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className={styles.row}>
              <Button
                variant={mode === 'replace' ? 'danger' : 'primary'}
                disabled={busy}
                onClick={() => (mode === 'replace' ? setConfirm(true) : void runImport())}
              >
                {t.backup.doImport}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.backup.confirmTitle}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>{t.actions.cancel}</Button>
            <Button variant="danger" onClick={() => void runImport()}>
              {t.backup.replace}
            </Button>
          </>
        }
      >
        <p>{t.backup.confirmText}</p>
      </Dialog>
    </Card>
  );
}
