import { useEffect, useState } from 'react';
import { t } from '@/strings';
import { formatCrackTime, measureStrength, type Score, type Strength } from '../strength';
import styles from '../accounts.module.css';

/** Pattern-based strength (zxcvbn) of `password`, debounced; hidden for an empty value. */
export function StrengthMeter({
  password,
  userInputs = [],
  onMeasured,
}: {
  password: string;
  userInputs?: string[];
  /** The measured score of the current value (`undefined` while empty or not measured yet). */
  onMeasured?: (score: Score | undefined) => void;
}) {
  const [result, setResult] = useState<{ password: string; strength: Strength }>();
  const inputs = userInputs.join('\u0000');

  useEffect(() => {
    if (!password) {
      onMeasured?.(undefined);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void measureStrength(password, inputs ? inputs.split('\u0000') : []).then((strength) => {
        if (cancelled) return;
        setResult({ password, strength });
        onMeasured?.(strength.score);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the callback is a state setter
  }, [password, inputs]);

  if (!password || result?.password !== password) return null;
  const { score, crackSeconds, warning } = result.strength;
  const warningText = warning ? t.accounts.strength.warnings[warning] : undefined;
  return (
    <div className={styles.meter} data-testid="strength" data-score={score}>
      <span>
        {t.accounts.strength.label}: <strong>{t.accounts.strength.levels[score]}</strong> ·{' '}
        {t.accounts.strength.crack(formatCrackTime(crackSeconds))}
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
      {warningText ? <span>{warningText}</span> : null}
    </div>
  );
}
