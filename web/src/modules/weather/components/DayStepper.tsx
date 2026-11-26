import type { KeyboardEvent } from 'react';
import { dateTimeFormat } from '@/core/i18n/format';
import { tWeatherPage } from '@/strings.weatherPage';
import { Button, Icon } from '@/ui';
import styles from '../routes/weather.module.css';
import { localDate } from './parts';

/** "Do. 26. Nov.": the short date of the stepper (the comma Intl puts after the weekday is dropped, COPY §4). */
function shortDate(date: string): string {
  const parts = dateTimeFormat({ weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(
    localDate(date, 12),
  );
  return parts
    .map((p, i) => (p.type === 'literal' && parts[i - 1]?.type === 'weekday' ? ' ' : p.value))
    .join('');
}

/** The label of the stepper: "Heute, Do. 26. Nov." or "Freitag, 27. Nov." (COPY §4). */
export function stepLabel(tp: ReturnType<typeof tWeatherPage.get>, date: string, today: string) {
  if (date === today) return tp.day.stepToday(shortDate(date));
  return dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'short' }).format(
    localDate(date, 12),
  );
}

/**
 * The day stepper under the head (CONCEPT-DAYS §1): `‹` · the shown day · `›`; at the first and the last offered day
 * the button stays, inactive (`aria-disabled`, still focusable: the row does not jump). "Heute" appears only while
 * another day is shown. ← and → on a focused button step too.
 */
export function DayStepper({
  days,
  date,
  today,
  onStep,
  onToday,
}: {
  /** The offered days, in order. */
  days: readonly string[];
  date: string;
  today: string;
  /** One day back (-1) or on (+1). */
  onStep: (dir: -1 | 1) => void;
  onToday: () => void;
}) {
  const tp = tWeatherPage.use();
  const i = days.indexOf(date);
  const prev = i > 0 ? days[i - 1] : undefined;
  const next = i >= 0 && i < days.length - 1 ? days[i + 1] : undefined;
  const keys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    onStep(e.key === 'ArrowLeft' ? -1 : 1);
  };
  return (
    <div
      className={styles.stepper}
      role="group"
      aria-label={tp.day.stepGroup}
      data-testid="weather-stepper"
    >
      <button
        type="button"
        className={styles.stepBtn}
        aria-label={tp.day.prev}
        aria-disabled={prev ? undefined : 'true'}
        onClick={() => onStep(-1)}
        onKeyDown={keys}
        data-testid="weather-step-prev"
      >
        <Icon name="chevronLeft" size={18} />
      </button>
      <span className={styles.stepLabel} data-testid="weather-step-label">
        {stepLabel(tp, date, today)}
      </span>
      <button
        type="button"
        className={styles.stepBtn}
        aria-label={tp.day.next}
        aria-disabled={next ? undefined : 'true'}
        onClick={() => onStep(1)}
        onKeyDown={keys}
        data-testid="weather-step-next"
      >
        <Icon name="chevronRight" size={18} />
      </button>
      {date !== today ? (
        <Button variant="secondary" onClick={onToday} data-testid="weather-step-today">
          {tp.day.today}
        </Button>
      ) : null}
    </div>
  );
}
