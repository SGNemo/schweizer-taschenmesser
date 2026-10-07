import { formatTimestamp, DATE_TIME_NUMERIC } from '@/core/i18n/format';
import { useEffect, useState } from 'react';
import {
  MAX_KEEP,
  MIN_KEEP,
  hasAutoPassphrase,
  listAutoBackups,
  loadAutoConfig,
  loadAutoLast,
  readAutoBackup,
  runAutoBackup,
  saveAutoConfig,
  setAutoPassphrase,
  type AutoBackupConfig,
  type AutoBackupFile,
  type AutoBackupLast,
} from '@/core/backup/auto';
import { AUTO_PASSPHRASE_SECRET } from '@/core/backup/safety';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Card, SelectField, Switch, TextField } from '@/ui';
import styles from './settings.module.css';

const stampToText = (stamp: string): string =>
  `${stamp.slice(6, 8)}.${stamp.slice(4, 6)}.${stamp.slice(0, 4)} ${stamp.slice(9, 11)}:${stamp.slice(11, 13)}`;

/** Automatic backups (installed app only). `onOpen` hands a stored file to the restore flow. */
export function AutoBackupCard({ onOpen }: { onOpen: (text: string, passphrase: string) => void }) {
  const toast = useUiStore((s) => s.toast);
  const platform = getPlatform();
  const [config, setConfig] = useState<AutoBackupConfig | undefined>();
  const [last, setLast] = useState<AutoBackupLast | undefined>();
  const [files, setFiles] = useState<AutoBackupFile[]>([]);
  const [hasPass, setHasPass] = useState(false);
  const [pass, setPass] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const load = async () => ({
    config: await loadAutoConfig(),
    last: await loadAutoLast(),
    hasPass: await hasAutoPassphrase(),
    files: await listAutoBackups().catch(() => []),
  });
  const apply = (v: Awaited<ReturnType<typeof load>>) => {
    setConfig(v.config);
    setLast(v.last);
    setHasPass(v.hasPass);
    setFiles(v.files);
  };
  const refresh = async () => apply(await load());

  useEffect(() => {
    if (!platform.isNative) return;
    let live = true;
    void load().then((v) => live && apply(v));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load/apply are stable; run once the platform is known
  }, [platform.isNative]);

  if (!platform.isNative) {
    return (
      <Card>
        <div className={styles.form}>
          <p className={styles.legend}>{t.backup.autoTitle}</p>
          <p className={styles.muted}>{t.backup.autoUnsupported}</p>
        </div>
      </Card>
    );
  }
  if (!config) return null;

  async function update(patch: Partial<AutoBackupConfig>) {
    const next = { ...config!, ...patch };
    setConfig(next);
    await saveAutoConfig(next);
  }

  async function savePassphrase() {
    setError(undefined);
    if (!(await setAutoPassphrase(pass))) return setError(t.backup.passphraseTooShort);
    setPass('');
    setHasPass(true);
  }

  async function runNow() {
    setBusy(true);
    setError(undefined);
    const outcome = await runAutoBackup({ force: true });
    setBusy(false);
    if (outcome.status === 'created') toast(t.backup.autoCreated);
    else if (outcome.status === 'skipped' && outcome.reason === 'no-passphrase')
      setError(t.backup.autoNeedPassphrase);
    else if (outcome.status === 'failed') setError(t.backup.autoLastFailed);
    await refresh();
  }

  async function open(name: string) {
    const passphrase = await platform.secrets.get(AUTO_PASSPHRASE_SECRET);
    if (!passphrase) return setError(t.backup.autoNeedPassphrase);
    try {
      onOpen(await readAutoBackup(name), passphrase);
    } catch {
      setError(t.backup.errors.invalid);
    }
  }

  async function saveAs(name: string) {
    try {
      await platform.saveFile({
        fileName: name,
        data: await readAutoBackup(name),
        mime: 'application/json',
      });
    } catch {
      setError(t.backup.errors.invalid);
    }
  }

  return (
    <Card>
      <div className={styles.form}>
        <p className={styles.legend}>{t.backup.autoTitle}</p>
        <p className={styles.muted}>{t.backup.autoIntro}</p>
        <Switch
          label={t.backup.autoEnable}
          checked={config.enabled}
          onChange={(enabled) => void update({ enabled })}
        />
        <SelectField
          label={t.backup.autoInterval}
          value={config.interval}
          onChange={(e) =>
            void update({ interval: e.target.value as AutoBackupConfig['interval'] })
          }
        >
          <option value="daily">{t.backup.autoDaily}</option>
          <option value="weekly">{t.backup.autoWeekly}</option>
        </SelectField>
        <TextField
          label={t.backup.autoKeep}
          type="number"
          min={MIN_KEEP}
          max={MAX_KEEP}
          value={config.keep}
          onChange={(e) => void update({ keep: Number(e.target.value) })}
        />
        <TextField
          label={t.backup.autoPassphrase}
          hint={hasPass ? t.backup.autoPassphraseSet : t.backup.autoPassphraseHint}
          type="password"
          autoComplete="new-password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        <div className={styles.row}>
          <Button onClick={() => void savePassphrase()} disabled={!pass}>
            {t.backup.autoSavePassphrase}
          </Button>
          <Button variant="primary" onClick={() => void runNow()} disabled={busy}>
            {t.backup.autoRunNow}
          </Button>
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <p className={styles.muted} data-testid="auto-backup-last">
          {t.backup.autoLast}:{' '}
          {last
            ? formatTimestamp(new Date(last.at).getTime(), DATE_TIME_NUMERIC)
            : t.backup.autoNever}
          {last && !last.ok ? ` – ${t.backup.autoLastFailed}` : ''}
        </p>
        <p className={styles.legend}>{t.backup.autoFiles}</p>
        {files.length === 0 ? <p className={styles.muted}>{t.backup.autoNoFiles}</p> : null}
        {files.map((f) => (
          <div key={f.name} className={styles.row}>
            <span>{stampToText(f.stamp)}</span>
            <Button onClick={() => void open(f.name)}>{t.backup.autoUse}</Button>
            <Button onClick={() => void saveAs(f.name)}>{t.backup.autoSaveAs}</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
