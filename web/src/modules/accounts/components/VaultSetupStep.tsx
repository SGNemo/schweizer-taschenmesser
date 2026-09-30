import { useEffect, useRef, useState } from 'react';
import { getSettings, setSettings } from '@/core/settings/settings';
import type { SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import { HelpHint, SelectField, Switch, TextField } from '@/ui';
import { biometricStatus, enableBiometricUnlock } from '../biometric';
import { defaultSettings, settingsSchema, type AccountsSettings } from '../settings';
import { createVault, MIN_MASTER_LENGTH, readHeader, type HeaderState } from '../vault';
import { StrengthMeter } from './StrengthMeter';
import styles from '../accounts.module.css';

const s = t.accounts.setupStep;

/**
 * Setup step of the vault. The vault is created only on "Weiter", with a password that is long
 * enough and repeated correctly – cancelling earlier leaves everything as it was. The password lives
 * in this component only (never in the setup state, never stored); biometrics need it once.
 */
export default function VaultSetupStep({ registerCommit, setCanContinue }: SetupStepProps) {
  const [header, setHeader] = useState<HeaderState | undefined>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [wantBio, setWantBio] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [prefs, setPrefs] = useState<AccountsSettings>(defaultSettings);
  const [prefsTouched, setPrefsTouched] = useState(false);
  const pw = useRef('');

  useEffect(() => {
    let live = true;
    void Promise.all([
      readHeader(),
      biometricStatus().catch(() => ({ available: false })),
      getSettings('module.accounts', settingsSchema, defaultSettings),
    ]).then(([h, b, current]) => {
      if (!live) return;
      setHeader(h);
      setBioAvailable(b.available);
      setPrefs(current);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    pw.current = password;
  }, [password]);

  const creating = header?.state === 'none';
  const valid = [...password].length >= MIN_MASTER_LENGTH && password === confirm;
  const ok = header?.state === 'ready' || (creating && valid);
  useEffect(() => setCanContinue(ok), [ok, setCanContinue]);

  useEffect(() => {
    if (!header || header.state === 'corrupt' || !ok) {
      registerCommit(null);
      return;
    }
    registerCommit(async () => {
      if (creating) {
        await createVault(pw.current);
        if (wantBio) await enableBiometricUnlock(pw.current).catch(() => 'cancelled');
      }
      if (prefsTouched) await setSettings('module.accounts', prefs);
    });
    return () => registerCommit(null);
  }, [header, ok, creating, wantBio, prefsTouched, prefs, registerCommit]);

  if (!header) return null;
  if (header.state === 'corrupt') return <p role="alert">{s.corrupt}</p>;

  return (
    <>
      {creating ? (
        <>
          <p className={styles.intro}>
            {t.accounts.setup.intro} <HelpHint text={t.help.vault} label={t.help.label} />
          </p>
          <p className={styles.warning} role="note">
            {t.accounts.setup.warning}
          </p>
          <TextField
            label={t.accounts.setup.password}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-autofocus
          />
          <StrengthMeter password={password} />
          <TextField
            label={t.accounts.setup.confirm}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={
              confirm && password !== confirm
                ? t.accounts.setup.mismatch
                : password && [...password].length < MIN_MASTER_LENGTH
                  ? t.accounts.setup.tooShort(MIN_MASTER_LENGTH)
                  : undefined
            }
          />
          {!ok ? <p role="status">{s.needed}</p> : null}
          {bioAvailable ? (
            <Switch
              label={s.biometric}
              hint={s.biometricHint}
              checked={wantBio}
              onChange={setWantBio}
            />
          ) : null}
        </>
      ) : (
        <p role="status">{s.hasVault}</p>
      )}
      <SelectField
        label={s.autoLock}
        value={prefs.autoLockMinutes}
        onChange={(e) => {
          setPrefsTouched(true);
          setPrefs({
            ...prefs,
            autoLockMinutes: e.target.value as AccountsSettings['autoLockMinutes'],
          });
        }}
      >
        {(['1', '5', '15', '30'] as const).map((m) => (
          <option key={m} value={m}>
            {s.minutes(m)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={s.backgroundLock}
        value={prefs.backgroundLock}
        onChange={(e) => {
          setPrefsTouched(true);
          setPrefs({
            ...prefs,
            backgroundLock: e.target.value as AccountsSettings['backgroundLock'],
          });
        }}
      >
        <option value="now">{s.now}</option>
        <option value="30s">{s.after30}</option>
      </SelectField>
    </>
  );
}
