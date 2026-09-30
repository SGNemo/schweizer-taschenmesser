import { useEffect, useState, type ChangeEvent } from 'react';
import {
  backupFileName,
  createBackup,
  serializeBackup,
  type Backup,
  type ImportMode,
} from '@/core/backup/backup';
import { downloadTextFile } from '@/core/backup/download';
import {
  MIN_BACKUP_PASSPHRASE_LENGTH,
  encryptBackup,
  encryptedBackupFileName,
  readBackupText,
  serializeEncryptedBackup,
} from '@/core/backup/encrypted';
import { planRestore, restoreBackup, type RestorePlan } from '@/core/backup/restore';
import { SafetyBackupError, createSafetyBackup } from '@/core/backup/safety';
import { verifyBackup, type VerifyReport } from '@/core/backup/verify';
import { db } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Card, Dialog, TextField } from '@/ui';
import { AutoBackupCard } from './AutoBackupCard';
import { PlanView, VerifyReportView } from './BackupParts';
import styles from './settings.module.css';

export function BackupSection() {
  const toast = useUiStore((s) => s.toast);
  const [exportPass, setExportPass] = useState('');
  const [exportError, setExportError] = useState<string | undefined>();

  const [text, setText] = useState<string | undefined>();
  const [pass, setPass] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const [backup, setBackup] = useState<Backup | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [planState, setPlanState] = useState<
    { backup: Backup; mode: ImportMode; plan: RestorePlan } | undefined
  >();
  const [report, setReport] = useState<VerifyReport | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function exportPlain() {
    const result = await downloadTextFile(backupFileName(), serializeBackup(await createBackup()));
    if (result === 'saved') toast(t.backup.exported);
  }

  async function exportEncrypted() {
    setExportError(undefined);
    if (exportPass.length < MIN_BACKUP_PASSPHRASE_LENGTH)
      return setExportError(t.backup.passphraseTooShort);
    setBusy(true);
    const file = await encryptBackup(await createBackup(), exportPass);
    const result = await downloadTextFile(
      encryptedBackupFileName(),
      serializeEncryptedBackup(file),
    );
    setBusy(false);
    if (result === 'saved') {
      setExportPass('');
      toast(t.backup.encryptedExported);
    }
  }

  function reset() {
    setBackup(undefined);
    setPlanState(undefined);
    setReport(undefined);
    setError(undefined);
    setNeedPass(false);
  }

  /** Reads `content`; asks for the passphrase when the file is encrypted. */
  async function load(content: string, passphrase?: string) {
    reset();
    setText(content);
    setBusy(true);
    const result = await readBackupText(content, passphrase);
    setBusy(false);
    if (result.ok) return setBackup(result.backup);
    if (result.reason === 'passphrase-required') return setNeedPass(true);
    if (result.reason === 'wrong-passphrase') setNeedPass(true);
    setError(t.backup.errors[result.reason]);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setText(undefined);
    setPass('');
    reset();
    if (file) await load(await file.text());
  }

  // Preview: what would a restore do in the chosen mode? Nothing is written here.
  useEffect(() => {
    if (!backup) return;
    let current = true;
    void planRestore(backup, mode, db, syncedTableNames(allManifests)).then(
      (plan) => current && setPlanState({ backup, mode, plan }),
    );
    return () => {
      current = false;
    };
  }, [backup, mode]);
  const plan =
    planState?.backup === backup && planState?.mode === mode ? planState.plan : undefined;

  async function runVerify() {
    if (!text) return;
    setBusy(true);
    setReport(undefined);
    setReport(await verifyBackup(text, pass || undefined));
    setBusy(false);
  }

  async function runImport() {
    if (!backup) return;
    setConfirm(false);
    setBusy(true);
    setError(undefined);
    try {
      const { summary } = await restoreBackup(backup, mode, {
        safety: () => createSafetyBackup(pass || undefined),
      });
      setBackup(undefined);
      setText(undefined);
      toast(t.backup.done(summary.records, summary.removed));
    } catch (e) {
      setError(
        e instanceof SafetyBackupError
          ? t.backup.errors[e.reason === 'cancelled' ? 'safety-cancelled' : 'safety-failed']
          : t.backup.errors['restore-error'],
      );
    }
    setBusy(false);
  }

  const counts = backup
    ? t.backup.contains(
        Object.values(backup.tables).reduce((n, rows) => n + rows.length, 0),
        Object.keys(backup.tables).length,
      )
    : '';

  return (
    <>
      <Card>
        <div className={styles.form}>
          <p>{t.backup.intro}</p>
          <p className={styles.muted}>{t.backup.exportHint}</p>
          <TextField
            label={t.backup.exportPassphrase}
            hint={t.backup.exportPassphraseHint}
            type="password"
            autoComplete="new-password"
            value={exportPass}
            onChange={(e) => setExportPass(e.target.value)}
          />
          {exportError ? (
            <p role="alert" className={styles.error}>
              {exportError}
            </p>
          ) : null}
          <div className={styles.row}>
            <Button variant="primary" disabled={busy} onClick={() => void exportEncrypted()}>
              {t.backup.encryptedExport}
            </Button>
            <Button onClick={() => void exportPlain()}>{t.backup.export}</Button>
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
          {needPass ? (
            <div className={styles.form}>
              <TextField
                label={t.backup.openPassphrase}
                type="password"
                autoComplete="off"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
              <div className={styles.row}>
                <Button
                  variant="primary"
                  disabled={busy || !pass || !text}
                  onClick={() => text && void load(text, pass)}
                >
                  {t.backup.unlock}
                </Button>
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className={styles.error} data-testid="backup-error">
              {error}
            </p>
          ) : null}

          {backup ? (
            <>
              <p data-testid="backup-contents">{counts}</p>
              <p className={styles.muted}>{t.backup.verifyHint}</p>
              <div className={styles.row}>
                <Button disabled={busy} onClick={() => void runVerify()}>
                  {busy && !report ? t.backup.verifying : t.backup.verify}
                </Button>
              </div>
              {report ? <VerifyReportView report={report} /> : null}
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
              {plan ? <PlanView plan={plan} /> : null}
              <div className={styles.row}>
                <Button
                  variant={mode === 'replace' ? 'danger' : 'primary'}
                  disabled={busy}
                  onClick={() => (mode === 'replace' ? setConfirm(true) : void runImport())}
                >
                  {busy ? t.backup.restoring : t.backup.doImport}
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
          {plan ? (
            <p>
              {t.backup.previewTotals(plan.totals.added, plan.totals.replaced, plan.totals.removed)}
            </p>
          ) : null}
        </Dialog>
      </Card>
      <AutoBackupCard
        onOpen={(content, passphrase) =>
          void load(content, passphrase).then(() => setPass(passphrase))
        }
      />
    </>
  );
}
