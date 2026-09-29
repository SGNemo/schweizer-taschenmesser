import { useState } from 'react';
import { t } from '@/strings';
import { Button, Form, HelpHint, TextField } from '@/ui';
import { createVault, MIN_MASTER_LENGTH, VaultError } from '../vault';
import styles from '../accounts.module.css';
import { StrengthMeter } from './StrengthMeter';

export function SetupScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if ([...password].length < MIN_MASTER_LENGTH)
      return setError(t.accounts.setup.tooShort(MIN_MASTER_LENGTH));
    if (password !== confirm) return setError(t.accounts.setup.mismatch);
    setBusy(true);
    try {
      await createVault(password);
    } catch (e) {
      setError(
        e instanceof VaultError && e.code === 'exists'
          ? t.accounts.setup.exists
          : t.accounts.lock.corrupt,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.center}>
      <p className={styles.intro}>
        {t.accounts.setup.intro} <HelpHint text={t.help.vault} label={t.help.label} />
      </p>
      <p className={styles.warning} role="note">
        {t.accounts.setup.warning}
      </p>
      <Form onSubmit={() => void submit()}>
        <TextField
          label={t.accounts.setup.password}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          data-autofocus
        />
        <StrengthMeter password={password} />
        <TextField
          label={t.accounts.setup.confirm}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError('');
          }}
          error={error}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? t.accounts.setup.creating : t.accounts.setup.create}
        </Button>
      </Form>
    </div>
  );
}
