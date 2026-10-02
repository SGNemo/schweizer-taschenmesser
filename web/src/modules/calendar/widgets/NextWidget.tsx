import { Link } from 'react-router';
import { useNow } from '@/core/focus/useNow';
import { useCalendarItems } from '@/core/modules/contributions';
import { useFocusSettings } from '@/core/settings/focus';
import { pad2, today } from '@/core/time/now';
import { t } from '@/strings';
import { KpiWidget, WidgetBody } from '@/ui';
import { kindLabel } from '../components/ItemRow';
import { minutesUntil, nextToday, untilLabel } from '../until';

/** "Als Nächstes": the time until the next appointment today as one big phrase (KPI type). */
export default function NextWidget() {
  const [settings] = useFocusSettings();
  const day = today();
  const items = useCalendarItems({ from: day, to: day });
  const tick = useNow(30_000, settings.timeToNext);
  const d = new Date(tick);
  const hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  if (!settings.timeToNext)
    return (
      <WidgetBody loading={false} isEmpty={false}>
        <p>{t.calendar.untilNext.off}</p>
        <Link to="/settings/darstellung#focus">{t.focus.next.offAction}</Link>
      </WidgetBody>
    );

  const next = items ? nextToday(items, hhmm) : undefined;
  return (
    <KpiWidget
      loading={!items}
      label={t.widgets.next}
      value={next ? untilLabel(minutesUntil(hhmm, next.time!)) : undefined}
      context={next ? `${next.time} ${next.title} · ${kindLabel(next.kind)}` : undefined}
      empty={t.calendar.untilNext.empty}
      emptyAction={{ label: t.homeEmpty.calendar, to: '/calendar?new=1' }}
    />
  );
}
