import { useEffect, useRef, useState } from 'react';
import { t } from '@/strings';
import { Button, Form, Icon, TextField } from '@/ui';
import { biometricStatus, unlockWithBiometrics, type BiometricStatus } from '../biometric';
import { unlockVault, VaultError } from '../vault';
import styles from '../accounts.module.css';

export function LockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState<BiometricStatus>();
  const prompted = useRef(false);

  async function unlockWithBiometric() {
    setError('');
    const result = await unlockWithBiometrics();
    if (result === 'invalid') setError(t.accounts.biometric.invalid);
    if (result === 'invalid' || result === 'unavailable') setBio(await biometricStatus());
  }

  useEffect(() => {
    void biometricStatus().then((status) => {
      setBio(status);
      // Offer the prompt once when the lock screen appears; dismissing it leaves the password field.
      if (status.enrolled && !prompted.current) {
        prompted.current = true;
        void unlockWithBiometric();
      }
    });
  }, []);

  async function submit() {
    setBusy(true);
    try {
      await unlockVault(password);
      setPassword('');
    } catch (e) {
      setPassword('');
      if (e instanceof VaultError && e.code === 'wrong-password') setError(t.accounts.lock.wrong);
      else if (e instanceof VaultError && e.code === 'throttled') {
        setError(t.accounts.lock.throttled(Math.ceil((e.retryInMs ?? 1000) / 1000)));
      } else setError(t.accounts.lock.corrupt);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.center}>
      <p className={styles.intro}>
        <Icon name="lock" size={18} /> {t.accounts.lock.intro}
      </p>
      <Form onSubmit={() => void submit()}>
        <TextField
          label={t.accounts.lock.password}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          error={error}
          data-autofocus
          autoFocus
        />
        <Button type="submit" variant="primary" disabled={busy || password === ''}>
          {busy ? t.accounts.lock.unlocking : t.accounts.lock.unlock}
        </Button>
      </Form>
      {bio?.enrolled ? (
        <Button onClick={() => void unlockWithBiometric()}>{t.accounts.biometric.unlock}</Button>
      ) : null}
    </div>
  );
}
