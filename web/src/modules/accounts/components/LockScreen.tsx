import { useEffect, useRef, useState } from 'react';
import { t } from '@/strings';
import { Button, Form, Icon, TextField } from '@/ui';
import {
  biometricStatus,
  unlockWithBiometrics,
  type BiometricStatus,
  type BiometricUnlockResult,
} from '../biometric';
import { unlockVault, VaultError } from '../vault';
import styles from '../accounts.module.css';

export function LockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState<BiometricStatus>();
  const prompted = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  // `data-autofocus` is read by Dialog only; the lock screen is a page, so it focuses its field itself:
  // when it appears, and when "Back" returns to it while it never left the screen. The router renders
  // navigations as transitions: a Back that comes before the next page rendered (busy device) leaves
  // this screen mounted, its path never changes in React, and that update can wait on the abandoned
  // one; the focus would stay on the link or the "Mehr" button that started it. So the browser's own
  // `popstate` is the signal. With a sheet still open the field is inert and the sheet keeps its focus.
  useEffect(() => {
    const focusField = () => root.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    focusField();
    const path = window.location.pathname;
    const onPop = () => {
      if (window.location.pathname === path) focusField();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  async function unlockWithBiometric() {
    setError('');
    let result: BiometricUnlockResult;
    try {
      result = await unlockWithBiometrics();
    } catch {
      // The OS refused (keystore gone, stale seal, prompt failure): the master password always works.
      result = 'invalid';
    }
    if (result === 'invalid') setError(t.accounts.biometric.invalid);
    if (result === 'invalid' || result === 'unavailable') {
      setBio(await biometricStatus().catch(() => ({ available: false, enrolled: false })));
    }
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
    <div className={styles.center} ref={root}>
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
