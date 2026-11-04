import { useNow } from '@/core/focus/useNow';
import { useCalendarItems } from '@/core/modules/contributions';
import { usePersonFilter } from '@/core/people/PersonFilter';
import { useFocusSettings } from '@/core/settings/focus';
import { pad2, today } from '@/core/time/now';
import { useMediaQuery } from '@/ui';
import { HeroSlot } from '@/ui/identity';
import { kindLabel } from './ItemRow';
import { minutesUntil, nextToday, untilLabel } from '../until';
import styles from '../routes/calendar.module.css';

/** Head line of the calendar: the next appointment today ("in 20 Min · 10:00 Teammeeting"). Respects the focus setting. */
export function NextEventLine() {
  const [settings] = useFocusSettings();
  // Phone: the head stays short; the appointment is the first row of the list (not rendered, so no hidden duplicate text).
  const phone = useMediaQuery('(max-width: 700px)');
  const day = today();
  const forPerson = usePersonFilter();
  const items = useCalendarItems({ from: day, to: day })?.filter(
    (i) => !forPerson || i.personId === forPerson,
  );
  const tick = useNow(30_000, settings.timeToNext);
  if (phone || !settings.timeToNext || !items) return null;
  const d = new Date(tick);
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const next = nextToday(items, hhmm);
  if (!next?.time) return null;
  return (
    <HeroSlot area="figure">
      <p className={styles.nextLine} data-testid="calendar-next">
        <strong>{untilLabel(minutesUntil(hhmm, next.time))}</strong>
        {` · ${next.time} ${next.title} · ${kindLabel(next.kind)}`}
      </p>
    </HeroSlot>
  );
}
