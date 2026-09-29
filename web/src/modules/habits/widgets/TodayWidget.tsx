import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { isScheduled } from '../logic';
import { checkRepo, habitRepo } from '../repo';

export default function TodayWidget() {
  const data = useLiveQuery(async () => {
    const day = today();
    const habits = (await habitRepo.active().toArray()).filter(
      (h) => !h.archived && isScheduled(h, day),
    );
    const done = new Set(
      (await checkRepo.active().toArray()).filter((c) => c.date === day).map((c) => c.habitId),
    );
    return { habits, done };
  }, []);
  const open = data?.habits.filter((h) => !data.done.has(h.id)) ?? [];
  return (
    <WidgetList
      loading={!data}
      empty={data && data.habits.length === 0 ? t.habits.widgetEmpty : undefined}
      headline={
        data ? t.habits.todayDone(data.habits.length - open.length, data.habits.length) : undefined
      }
      entries={open.slice(0, 4).map((h) => ({ key: h.id, title: h.name }))}
      to="/habits"
      linkLabel={t.habits.title}
    />
  );
}
