import { useCalendarItems } from '@/core/modules/contributions';
import { addDaysStr, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { TimelineWidget, useWidgetSize, type TimelineItem } from '@/ui';
import { CalendarLeaf } from '@/ui/identity';
import { dateTimeFormat } from '@/core/i18n/format';
import styles from './widgets.module.css';
import { kindLabel } from '../components/ItemRow';

const toTimeline = (i: NonNullable<ReturnType<typeof useCalendarItems>>[number]): TimelineItem => ({
  key: `${i.source}:${i.id}:${i.date}`,
  title: i.title,
  time: i.time,
  endTime: i.endTime,
  allDay: i.allDay,
  kind: kindLabel(i.kind),
  to: i.to,
});

/** "Heute" as a timeline: current time marked, next appointment highlighted; size l adds tomorrow. */
export default function TodayWidget() {
  const day = today();
  const next = addDaysStr(day, 1);
  const items = useCalendarItems({ from: day, to: next });
  // The planner's day chip is no appointment: the day plan stays on the „Heute“ card.
  const open = (items ?? []).filter((i) => !i.done && i.kind !== 'plan');
  const d = new Date(now());
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const size = useWidgetSize();
  const date = new Date(`${day}T12:00:00`);
  return (
    <div className={styles.todayRow}>
      {/* The module's signature in small (identity v2); the small widget stays a plain timeline. */}
      {size !== 's' ? (
        <CalendarLeaf
          size="sm"
          month={dateTimeFormat({ month: 'short' }).format(date)}
          day={String(date.getDate())}
        />
      ) : null}
      <div className={styles.todayBody}>
        <TimelineWidget
          loading={!items}
          empty={t.calendar.widgetEmpty}
          emptyAction={{ label: t.homeEmpty.calendar, to: '/calendar?new=1' }}
          today={open.filter((i) => i.date === day).map(toTimeline)}
          tomorrow={open.filter((i) => i.date === next).map(toTimeline)}
          now={hhmm}
        />
      </div>
    </div>
  );
}
