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
 * no click target. `wide` sits right of the wordmark in the sidebar head, `rail` under the tile of the
 * folded sidebar as one small line "14:07" (12-hour locales show the digits without "PM", which does not fit),
 * `bar` next to the logo in the phone top bar.
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
  const linked = (time: ReactElement, compact = false): ReactElement =>
    clockModule ? (
      <Link
        to="/clock"
        className={compact ? `${styles.link} ${styles.railTime}` : styles.link}
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
    // One short line under the tile: the digits only ("AM"/"PM" would not fit; the label carries it).
    return linked(
      <time
        className={`${styles.clock} ${styles.rail}`}
        dateTime={iso}
        aria-label={label}
        data-testid="logo-clock"
      >
        {digits(parts)}
      </time>,
      true,
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
