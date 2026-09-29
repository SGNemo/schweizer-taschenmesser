import { useEffect, useState } from 'react';
import { t } from '@/strings';
import { measureStrength, type Strength } from '../strength';
import styles from '../accounts.module.css';

/** Pattern-based strength (zxcvbn) of `password`, debounced; hidden for an empty value. */
export function StrengthMeter({
  password,
  userInputs = [],
}: {
  password: string;
  userInputs?: string[];
}) {
  const [result, setResult] = useState<{ password: string; strength: Strength }>();
  const inputs = userInputs.join('\u0000');

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void measureStrength(password, inputs ? inputs.split('\u0000') : []).then(
        (strength) => !cancelled && setResult({ password, strength }),
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [password, inputs]);

  if (!password || result?.password !== password) return null;
  const { score, crackTime, warning } = result.strength;
  return (
    <div className={styles.meter} data-testid="strength" data-score={score}>
      <span>
        {t.accounts.strength.label}: <strong>{t.accounts.strength.levels[score]}</strong> ·{' '}
        {t.accounts.strength.crack(crackTime)}
      </span>
      <div
        className={styles.meterBar}
        role="progressbar"
        aria-label={t.accounts.strength.label}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={t.accounts.strength.levels[score]}
      >
        <div className={styles.meterFill} style={{ width: `${(score + 1) * 20}%` }} />
      </div>
      {warning ? <span>{warning}</span> : null}
    </div>
  );
}
