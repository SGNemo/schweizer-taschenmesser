import { useState } from 'react';
import { t } from '@/strings';
import { Button, Form, HelpHint, TextField } from '@/ui';
import { createVault, MIN_MASTER_LENGTH, VaultError } from '../vault';
import styles from '../accounts.module.css';
import { measureStrength, StrengthUnavailable, type Score } from '../strength';
import { StrengthMeter } from './StrengthMeter';
import { isWeakScore, WeakPasswordHelp } from './WeakPasswordHelp';

export function SetupScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<Score | undefined>();
  const [weakOk, setWeakOk] = useState(false);

  async function submit() {
    if ([...password].length < MIN_MASTER_LENGTH)
      return setError(t.accounts.setup.tooShort(MIN_MASTER_LENGTH));
    if (password !== confirm) return setError(t.accounts.setup.mismatch);
    setBusy(true);
    try {
      // A weak password is allowed, but only after the person said so.
      // Offline before the dictionaries ever loaded: no score, so no advice (it never blocks anyway).
      const measured =
        score ??
        (await measureStrength(password).then(
          (m) => m.score,
          (e: unknown) => {
            if (e instanceof StrengthUnavailable) return undefined;
            throw e;
          },
        ));
      const weak = isWeakScore(measured);
      if (weak && !weakOk) {
        setError(t.accounts.setup.weakNeedAck);
        return;
      }
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
            setScore(undefined);
            setWeakOk(false);
            setError('');
          }}
          data-autofocus
        />
        <StrengthMeter password={password} onMeasured={setScore} />
        {isWeakScore(score) ? (
          <WeakPasswordHelp
            acknowledged={weakOk}
            onAcknowledge={setWeakOk}
            onSuggest={(phrase) => {
              setPassword(phrase);
              setConfirm(phrase);
              setScore(undefined);
              setWeakOk(false);
              setError('');
            }}
          />
        ) : null}
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
