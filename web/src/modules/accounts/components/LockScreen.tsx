import { useState } from 'react';
import { t } from '@/strings';
import { Button, Form, Icon, TextField } from '@/ui';
import { unlockVault, VaultError } from '../vault';
import styles from '../accounts.module.css';

export function LockScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    </div>
  );
}
