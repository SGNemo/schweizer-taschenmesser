import { useEffect, useState } from 'react';
import { CryptoError } from '@/core/crypto';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog, Form, Switch, TextField } from '@/ui';
import {
  biometricStatus,
  disableBiometricUnlock,
  enableBiometricUnlock,
  type BiometricStatus,
} from '../biometric';
import { exportEncryptedBackup, importEncryptedBackup, withoutDuplicates } from '../backup';
import { CsvFormatError, exportBitwardenCsv, importBitwardenCsv } from '../csv';
import type { EntryData } from '../schema';
import {
  changeMasterPassword,
  MIN_MASTER_LENGTH,
  saveEntry,
  VaultError,
  type DecryptedEntry,
} from '../vault';
import styles from '../accounts.module.css';

const toast = (message: string) => useUiStore.getState().toast(message);

async function importEntries(
  incoming: EntryData[],
  existing: readonly DecryptedEntry[],
  skipped = 0,
) {
  const { fresh, duplicates } = withoutDuplicates(
    existing.map((e) => e.data),
    incoming,
  );
  for (const entry of fresh) await saveEntry(entry);
  toast(t.accounts.tools.importDone(fresh.length, duplicates, skipped));
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function ToolsDialog({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: readonly DecryptedEntry[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.accounts.tools.title}>
      {open ? <Body entries={entries} onClose={onClose} /> : null}
    </Dialog>
  );
}

function Body({ entries, onClose }: { entries: readonly DecryptedEntry[]; onClose: () => void }) {
  const tl = t.accounts.tools;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [csvConfirmed, setCsvConfirmed] = useState(false);
  const [backupPw, setBackupPw] = useState('');
  const [importPw, setImportPw] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [bio, setBio] = useState<BiometricStatus>();
  const [bioPw, setBioPw] = useState('');

  useEffect(() => {
    void biometricStatus().then(setBio);
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  const saveText = async (fileName: string, data: string, mime: string) => {
    if ((await getPlatform().saveFile({ fileName, data, mime })) === 'saved') toast(tl.exported);
  };

  async function pickText(accept: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () =>
        void (input.files?.[0]?.text() ?? Promise.resolve(undefined)).then(resolve);
      input.oncancel = () => resolve(undefined);
      input.click();
    });
  }

  return (
    <div className={styles.grid}>
      <h3>{tl.export}</h3>
      <p className={styles.warning} role="note">
        {tl.csvWarning}
      </p>
      <Switch label={tl.csvConfirm} checked={csvConfirmed} onChange={setCsvConfirmed} />
      <Button
        disabled={busy || !csvConfirmed || entries.length === 0}
        onClick={() =>
          void saveText(
            `taschenmesser-accounts-${stamp()}.csv`,
            exportBitwardenCsv(entries.map((e) => e.data)),
            'text/csv',
          )
        }
      >
        {tl.csvExport}
      </Button>

      <Form
        onSubmit={() =>
          void run(async () => {
            if ([...backupPw].length < MIN_MASTER_LENGTH)
              return setError(t.accounts.setup.tooShort(MIN_MASTER_LENGTH));
            const json = await exportEncryptedBackup(
              entries.map((e) => e.data),
              backupPw,
            );
            setBackupPw('');
            await saveText(`taschenmesser-accounts-${stamp()}.json`, json, 'application/json');
          })
        }
      >
        <TextField
          label={tl.backupPassword}
          hint={tl.backupPasswordHint}
          type="password"
          autoComplete="new-password"
          value={backupPw}
          onChange={(e) => setBackupPw(e.target.value)}
        />
        <Button type="submit" disabled={busy || backupPw === '' || entries.length === 0}>
          {busy ? tl.working : tl.backupExport}
        </Button>
      </Form>

      <h3>{tl.import}</h3>
      <Button
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const text = await pickText('.csv,text/csv');
            if (text === undefined) return;
            try {
              const { entries: incoming, skipped } = importBitwardenCsv(text);
              await importEntries(incoming, entries, skipped);
            } catch (e) {
              if (e instanceof CsvFormatError) setError(tl.importFailedCsv);
              else throw e;
            }
          })
        }
      >
        {tl.csvImport}
      </Button>
      <Form
        onSubmit={() =>
          void run(async () => {
            const text = await pickText('.json,application/json');
            if (text === undefined) return;
            try {
              await importEntries(await importEncryptedBackup(text, importPw), entries);
              setImportPw('');
            } catch (e) {
              if (e instanceof CryptoError) setError(tl.importFailedBackup);
              else throw e;
            }
          })
        }
      >
        <TextField
          label={tl.backupPasswordImport}
          type="password"
          autoComplete="off"
          value={importPw}
          onChange={(e) => setImportPw(e.target.value)}
        />
        <Button type="submit" disabled={busy || importPw === ''}>
          {tl.backupImport}
        </Button>
      </Form>

      <h3>{t.accounts.biometric.title}</h3>
      {bio && !bio.available ? (
        <p className={styles.notice}>{t.accounts.biometric.unavailable}</p>
      ) : null}
      {bio?.available && bio.enrolled ? (
        <>
          <p className={styles.notice}>{t.accounts.biometric.enabledNote}</p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await disableBiometricUnlock();
                setBio(await biometricStatus());
                toast(t.accounts.biometric.disabled);
              })
            }
          >
            {t.accounts.biometric.disable}
          </Button>
        </>
      ) : null}
      {bio?.available && !bio.enrolled ? (
        <Form
          onSubmit={() =>
            void run(async () => {
              try {
                const result = await enableBiometricUnlock(bioPw);
                setBioPw('');
                setBio(await biometricStatus());
                toast(
                  result === 'enabled'
                    ? t.accounts.biometric.enabled
                    : t.accounts.biometric.cancelled,
                );
              } catch (e) {
                if (e instanceof VaultError && e.code === 'wrong-password')
                  setError(t.accounts.lock.wrong);
                else throw e;
              }
            })
          }
        >
          <TextField
            label={t.accounts.biometric.enterPassword}
            hint={t.accounts.biometric.windowsNote}
            type="password"
            autoComplete="current-password"
            value={bioPw}
            onChange={(e) => setBioPw(e.target.value)}
          />
          <Button type="submit" disabled={busy || bioPw === ''}>
            {t.accounts.biometric.enable}
          </Button>
        </Form>
      ) : null}

      <h3>{tl.changePassword}</h3>
      <Form
        onSubmit={() =>
          void run(async () => {
            try {
              await changeMasterPassword(oldPw, newPw);
              setOldPw('');
              setNewPw('');
              toast(tl.passwordChanged);
              onClose();
            } catch (e) {
              if (e instanceof VaultError && e.code === 'weak-password')
                setError(t.accounts.setup.tooShort(MIN_MASTER_LENGTH));
              else if (e instanceof VaultError && e.code === 'wrong-password')
                setError(t.accounts.lock.wrong);
              else throw e;
            }
          })
        }
      >
        <TextField
          label={tl.oldPassword}
          type="password"
          autoComplete="current-password"
          value={oldPw}
          onChange={(e) => setOldPw(e.target.value)}
        />
        <TextField
          label={tl.newPassword}
          type="password"
          autoComplete="new-password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />
        <Button type="submit" disabled={busy || oldPw === '' || newPw === ''}>
          {busy ? tl.working : tl.changePassword}
        </Button>
      </Form>
      {error ? (
        <p role="alert" className={styles.warning}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
