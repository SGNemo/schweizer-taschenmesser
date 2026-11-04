import type { CSSProperties } from 'react';
import { tIdentity } from '@/strings.identity';
import styles from './HourStrip.module.css';

export interface StripEvent {
  /** 'HH:mm' */
  time: string;
  /** 'HH:mm'; without it the event fills its starting hour. */
  endTime?: string;
}

const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};

/**
 * Today's hours as a row of blocks (`zeit` head): an hour with an appointment is filled in the module hue, the current
 * hour carries the "now" marker. Decorative (`aria-hidden`); its text equivalent is the `aria-label` on the wrapper and the
 * page's own agenda. Hours outside `from`–`to` are not drawn.
 */
export function HourStrip({
  events,
  now,
  from = 8,
  to = 19,
}: {
  events: readonly StripEvent[];
  /** Current time 'HH:mm'; omit to draw no marker. */
  now?: string;
  from?: number;
  to?: number;
}) {
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const busy = (h: number) =>
    events.some((e) => {
      const start = minutes(e.time);
      const end = e.endTime && minutes(e.endTime) > start ? minutes(e.endTime) : start + 60;
      return start < (h + 1) * 60 && end > h * 60;
    });
  const nowHour = now ? Math.floor(minutes(now) / 60) : undefined;
  return (
    <div
      className={styles.strip}
      style={{ '--hours': hours.length } as CSSProperties}
      role="img"
      aria-label={tIdentity.get().head.hourStrip(events.length)}
      data-testid="hour-strip"
    >
      <div className={styles.bars} aria-hidden="true">
        {hours.map((h) => (
          <i
            key={h}
            data-busy={busy(h) ? 'true' : undefined}
            data-now={h === nowHour ? 'true' : undefined}
          />
        ))}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {hours.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </div>
    </div>
  );
}
