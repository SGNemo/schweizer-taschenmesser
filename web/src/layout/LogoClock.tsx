import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { dateTimeFormat, useFormatLocale } from '@/core/i18n/format';
import { useModuleStates } from '@/core/modules/activation';
import { pad2 } from '@/core/time/now';
import { useMinuteNow } from '@/core/time/useMinuteNow';
import { tClock } from '@/strings.clock';
import styles from './LogoClock.module.css';

const HOUR_MINUTE: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/** Hours and minutes without the day period ("02:07" of "02:07 PM"), which is set smaller next to them. */
function digits(parts: Intl.DateTimeFormatPart[]): string {
  return parts
    .filter((p) => p.type !== 'dayPeriod')
    .map((p) => p.value)
    .join('')
    .trim();
}

/** Widest digits of the locale's format (10:58 and 22:58), so the box never changes width. */
function widthCh(fmt: Intl.DateTimeFormat): number {
  const sample = (h: number) => digits(fmt.formatToParts(new Date(2026, 0, 1, h, 58))).length;
  return Math.max(sample(10), sample(22));
}

/**
 * The time next to the Nemo logo (the window often covers the taskbar): quiet secondary text, no seconds, no
 * date. While the Uhr module is on, a click opens it (`/clock`, by route only: no module import); otherwise it is
 * no click target. `wide` sits right of the wordmark in the sidebar head, `rail` under the mark of the
 * folded sidebar as "14" over "07" (hidden by a container query when the rail is too narrow, and for 12-hour
 * locales, whose "PM" does not fit), `bar` next to the logo in the phone top bar.
 */
export function LogoClock({ variant }: { variant: 'wide' | 'rail' | 'bar' }) {
  const clockModule = useModuleStates()?.['clock'] === true;
  const tx = tClock.use();
  useFormatLocale();
  const at = useMinuteNow();
  const d = new Date(at);
  const fmt = dateTimeFormat(HOUR_MINUTE);
  const text = fmt.format(d);
  const iso = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const label = `${tx.label} ${text}`;
  const linked = (time: ReactElement): ReactElement =>
    clockModule ? (
      <Link
        to="/clock"
        className={styles.link}
        aria-label={tx.open(text)}
        data-testid="logo-clock-link"
      >
        {time}
      </Link>
    ) : (
      time
    );
  const parts = fmt.formatToParts(d);
  const period = parts.find((p) => p.type === 'dayPeriod')?.value;

  if (variant === 'rail') {
    if (period) return null;
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    return linked(
      <time
        className={`${styles.clock} ${styles.rail}`}
        dateTime={iso}
        aria-label={label}
        data-testid="logo-clock"
      >
        <span>{part('hour')}</span>
        <span className="sr-only">{part('literal') || ':'}</span>
        <span>{part('minute')}</span>
      </time>,
    );
  }
  return linked(
    <time
      className={`${styles.clock} ${styles[variant]}`}
      data-period={period ? 'true' : undefined}
      dateTime={iso}
      aria-label={label}
      data-testid="logo-clock"
    >
      <span className={styles.digits} style={{ minWidth: `${widthCh(fmt)}ch` }}>
        {digits(parts)}
      </span>
      {period ? <span className={styles.period}>{period}</span> : null}
    </time>,
  );
}
