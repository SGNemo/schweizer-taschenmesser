import { useLiveQuery } from 'dexie-react-hooks';
import { formatDay } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { nextOccurrenceAt, sortReminders } from '../logic';
import { reminderRepo } from '../repo';

export default function NextRemindersWidget() {
  const next = useLiveQuery(async () => {
    const list = sortReminders(await reminderRepo.active().toArray(), now());
    return list
      .filter((r) => r.active)
      .flatMap((r) => {
        const o = nextOccurrenceAt(r, now());
        return o ? [{ id: r.id, title: r.title, ...o }] : [];
      })
      .slice(0, 3);
  }, []);
  return (
    <WidgetList
      loading={!next}
      empty={t.reminders.widgetEmpty}
      entries={(next ?? []).map((o) => ({
        key: o.id,
        title: o.title,
        meta: `${formatDay(o.date, 'EEE, d. MMM')} · ${o.time}`,
      }))}
      to="/reminders"
      linkLabel={t.reminders.title}
    />
  );
}
