import { Ring } from '@/ui/identity';
import { t } from '@/strings';
import styles from '../routes/reminders.module.css';

/** The ring covers the next day: the nearer the reminder, the fuller the ring. */
const HORIZON_MINUTES = 24 * 60;

/**
 * "Zeitring" of the reminders: a still ring (built from the shared `Ring`) that fills as the next
 * reminder comes closer, with the time as plain text beside it. It never moves; the number is
 * what carries the meaning.
 */
export function BellRing({ minutesUntilNext }: { minutesUntilNext: number | null }) {
  const within = minutesUntilNext !== null && minutesUntilNext <= HORIZON_MINUTES;
  const share = within ? 1 - Math.max(0, minutesUntilNext) / HORIZON_MINUTES : 0;
  const when = within ? t.calendar.reminders.ringIn(Math.max(0, minutesUntilNext)) : null;
  return (
    <div className={styles.bell} data-testid="bell-ring">
      <Ring
        size={3.5}
        parts={[{ label: '', share: Math.max(share, 0.02) }]}
        label={when ? t.calendar.reminders.ringLabel(when) : t.calendar.reminders.ringNone}
      />
      <span className={styles.bellText}>
        {when ? t.calendar.reminders.ringLabel(when) : t.calendar.reminders.ringNone}
      </span>
    </div>
  );
}
