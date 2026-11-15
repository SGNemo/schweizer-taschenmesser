import { useEffect, useState } from 'react';
import { BackupExportForm } from '@/core/backup/BackupExport';
import { backupCounts, type Backup, type ImportMode } from '@/core/backup/backup';
import { readBackupText } from '@/core/backup/encrypted';
import { planRestore, restoreBackup, type RestorePlan } from '@/core/backup/restore';
import { SafetyBackupError, createSafetyBackup } from '@/core/backup/safety';
import { verifyBackup, type VerifyReport } from '@/core/backup/verify';
import { db } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';

import { t } from '@/strings';
import { tSettingsConnect } from '@/strings.settingsConnect';
import { useUiStore } from '@/stores/ui';
import { Button, Card, Dialog, FileField, TextField } from '@/ui';
import { AutoBackupCard } from './AutoBackupCard';
import { MoveCard } from './MoveCard';
import { PlanView, VerifyReportView } from './BackupParts';
import { Step } from './ConnectParts';
import styles from './settings.module.css';

export function BackupSection() {
  const c = tSettingsConnect.use().backup;
  const toast = useUiStore((s) => s.toast);

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

  async function onFile(files: FileList) {
    const file = files[0];
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

  const filled = backup ? backupCounts(backup) : undefined;
  const counts = filled ? t.backup.contains(filled.records, filled.tables) : '';

  return (
    <>
      <Card>
        <div className={styles.form}>
          <p className={styles.muted}>{t.backup.intro}</p>
          <Step n={1} title={c.stepSave} hint={c.stepSaveHint}>
            {/* Secondary since settings identity v3.1: the tab's one filled action is "Verbinden" (Sync). */}
            <BackupExportForm />
          </Step>
          <Step n={2} title={c.stepRestore} hint={c.stepRestoreHint}>
            <FileField
              id="backup-file"
              label={t.backup.file}
              accept="application/json,.json"
              onFiles={(files) => void onFile(files)}
            />
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
          </Step>
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
      <MoveCard />
      <AutoBackupCard
        onOpen={(content, passphrase) =>
          void load(content, passphrase).then(() => setPass(passphrase))
        }
      />
    </>
  );
}
