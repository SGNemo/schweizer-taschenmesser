import { Link } from 'react-router';
import { useNow } from '@/core/focus/useNow';
import { formatMinutes } from '@/core/i18n/format';
import { dayName } from '@/core/plan/explain';
import { useFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { ProgressList, useWidgetSize, type ProgressEntry } from '@/ui';
import { rowsFor } from '@/ui/widgets/size';
import type { BoardDay } from '../board';
import { capacityState } from '../components/capacity';
import { REST_PATH, restOffered } from '../rest';
import { useBoard } from '../useBoard';
import styles from './WeekWidget.module.css';

const compact = (min: number) => formatMinutes(min, { compact: true });

/** One `ProgressList` row per day; `overText` is never set (an overrun is said in `detail`, never painted red). */
export function weekEntries(days: readonly BoardDay[]): ProgressEntry[] {
  return days.map((d) => {
    const w = t.planner.widget;
    const name = dayName(d.date);
    const state = capacityState(d);
    const label = d.isToday
      ? state === 'off'
        ? w.todayOff
        : state === 'noTime'
          ? w.todayNoTime
          : state === 'full'
            ? w.todayFull
            : w.today(compact(d.free))
      : state === 'off'
        ? w.dayOff(name)
        : state === 'noTime'
          ? w.dayNoTime(name)
          : state === 'full'
            ? w.dayFull(name)
            : w.day(name, compact(d.free));
    const detail =
      d.over > 0
        ? t.planner.widget.over(compact(d.over))
        : d.planned > 0
          ? t.planner.widget.planned(compact(d.planned))
          : t.planner.widget.nothing;
    return { key: d.date, title: label, value: d.planned, max: Math.max(d.usable, 1), detail };
  });
}

/** „Bis Sa: 8 h 55 geplant · 6 h 41 frei“ – labelled with the last shown day, summed over exactly the shown rows. */
export function weekSummary(days: readonly BoardDay[]): string | undefined {
  const last = days[days.length - 1];
  if (!last) return undefined;
  const planned = days.reduce((n, d) => n + d.planned, 0);
  const free = days.reduce((n, d) => n + d.free, 0);
  return t.planner.widget.until(dayName(last.date), compact(planned), compact(free));
}

/**
 * The week's load: s = today and tomorrow, m = four days, l = six days from today. In the evening (from 17:00,
 * `focus.eveningWrapUp`) one quiet text action „Rest verteilen“ while today holds something open: it opens the
 * planner's preview, nothing moves before „Übernehmen“, and it never names how much was left.
 */
export default function WeekWidget() {
  const size = useWidgetSize();
  const span = rowsFor(size, [2, 4, 6]);
  const data = useBoard(span);
  const [focus] = useFocusSettings();
  const clock = useNow(60_000, focus.eveningWrapUp);
  const days = data?.board.days ?? [];
  const hasPlan = days.some((d) => d.planned > 0);
  // Not on the smallest card (as the ToDo widget's evening card): its two rows stay alone there.
  const rest = size !== 's' && restOffered(focus.eveningWrapUp, clock, days[0]);
  return (
    <>
      <ProgressList
        loading={!data}
        empty={t.planner.empty}
        emptyAction={{ label: t.homeEmpty.planner, to: '/planner?new=1' }}
        summary={hasPlan ? weekSummary(days) : undefined}
        entries={hasPlan ? weekEntries(days) : []}
      />
      {rest ? (
        <p className={styles.rest} data-testid="week-rest">
          <Link to={REST_PATH}>{t.planner.rest.link}</Link>
        </p>
      ) : null}
    </>
  );
}
