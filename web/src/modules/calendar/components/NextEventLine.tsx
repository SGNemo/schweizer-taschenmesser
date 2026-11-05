import { useNow } from '@/core/focus/useNow';
import { useCalendarItems } from '@/core/modules/contributions';
import { usePersonFilter } from '@/core/people/PersonFilter';
import { useFocusSettings } from '@/core/settings/focus';
import { addDaysStr, formatDay } from '@/core/time/dates';
import { pad2, today } from '@/core/time/now';
import { t } from '@/strings';
import { Button } from '@/ui';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { usePageWidthAtLeast } from '@/ui/pageWidth';
import { kindLabel } from './ItemRow';
import { minutesUntil, nextToday, untilLabel } from '../until';
import styles from '../routes/calendar.module.css';

/** How far the free head looks ahead for "Als Nächstes". */
const AHEAD_DAYS = 14;

/**
 * Head line of the calendar. With an appointment left today: the countdown line ("in 20 Min · 10:00 Teammeeting",
 * follows the focus setting). Without one the head is not left empty: "Heute frei" with what comes next in the coming
 * two weeks, or – nothing planned at all – the page's one verb again ("Neuer Termin").
 */
export function NextEventLine({ onAdd }: { onAdd?: () => void }) {
  const [settings] = useFocusSettings();
  // F15: a narrow page (phone) keeps the countdown out of the head; the appointment is the first row of the list.
  const narrow = usePageWidthAtLeast(40) === false;
  const day = today();
  const forPerson = usePersonFilter();
  const items = useCalendarItems({ from: day, to: addDaysStr(day, AHEAD_DAYS) })?.filter(
    // The planner's day chip is no appointment: it never makes a day look busy here (CONCEPT §5).
    (i) => !i.done && i.kind !== 'plan' && (!forPerson || i.personId === forPerson),
  );
  const tick = useNow(30_000, settings.timeToNext);
  if (!items) return null;
  const d = new Date(tick);
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const todays = items.filter((i) => i.date === day);
  const next = nextToday(todays, hhmm);
  if (next?.time) {
    if (narrow || !settings.timeToNext) return null;
    return (
      <HeroSlot area="figure">
        <p className={styles.nextLine} data-testid="calendar-next">
          <strong>{untilLabel(minutesUntil(hhmm, next.time))}</strong>
          {` · ${next.time} ${next.title} · ${kindLabel(next.kind)}`}
        </p>
      </HeroSlot>
    );
  }
  const h = t.calendar.headFree;
  const upcoming = items
    .filter((i) => i.date > day)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))[0];
  return (
    <>
      <HeroSlot area="figure">
        <div data-testid="calendar-free">
          <HeroFigure
            value={todays.length > 0 ? h.rest : h.today}
            detail={
              upcoming
                ? h.next(
                    `${formatDay(upcoming.date, 'EEE, d. MMM')}${upcoming.time ? `, ${upcoming.time}` : ''}`,
                    `${upcoming.title} · ${kindLabel(upcoming.kind)}`,
                  )
                : h.none
            }
          />
        </div>
      </HeroSlot>
      {!upcoming && onAdd ? (
        <HeroSlot>
          <Button onClick={onAdd}>{t.calendar.newEvent}</Button>
        </HeroSlot>
      ) : null}
    </>
  );
}
