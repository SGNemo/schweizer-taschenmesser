import { useEffect, useState } from 'react';
import { OfflineNotice, page } from '@/core/net/OnlineChunk';
import { t } from '@/strings';
import { tOffline } from '@/strings.offline';
import {
  formatCrackTime,
  measureStrength,
  StrengthUnavailable,
  type Score,
  type Strength,
} from '../strength';
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
  // The dictionaries never loaded and the device is offline: one calm note, measured again once online.
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inputs = userInputs.join('\u0000');

  useEffect(() => {
    if (!unavailable) return;
    const again = () => setAttempt((n) => n + 1);
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [unavailable]);

  useEffect(() => {
    if (!password) {
      onMeasured?.(undefined);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      measureStrength(password, inputs ? inputs.split('\u0000') : []).then(
        (strength) => {
          if (cancelled) return;
          setUnavailable(false);
          setResult({ password, strength });
          onMeasured?.(strength.score);
        },
        (e: unknown) => {
          if (cancelled || !(e instanceof StrengthUnavailable)) return;
          setUnavailable(true);
          onMeasured?.(undefined);
        },
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the callback is a state setter
  }, [password, inputs, attempt]);

  // Online again and still not loadable: the page remembers the failed import, a reload loads it.
  if (password && unavailable && result?.password !== password)
    return (
      <OfflineNotice
        text={tOffline.get().strength}
        onRetry={navigator.onLine && attempt > 0 ? page.reload : undefined}
      />
    );
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
