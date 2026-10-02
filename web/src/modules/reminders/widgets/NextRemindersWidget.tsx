import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { dueState } from '@/core/time/due';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { DueList } from '@/ui';
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
      });
  }, []);
  const day = today();
  return (
    <DueList
      loading={!next}
      empty={t.reminders.widgetEmpty}
      emptyAction={{ label: t.homeEmpty.reminders, to: '/reminders?new=1' }}
      entries={(next ?? []).map((o) => {
        const s = dueState(o.date, day);
        return { key: o.id, title: o.title, tone: s.tone, label: `${s.label} · ${o.time}` };
      })}
      moreLabel={t.widgets.more}
    />
  );
}
