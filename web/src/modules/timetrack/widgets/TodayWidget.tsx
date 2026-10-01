import { useLiveQuery } from 'dexie-react-hooks';
import { today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { WidgetList } from '@/ui';
import { formatMinutes, runningEntry, totalsByProject } from '../logic';
import { entryRepo, projectRepo } from '../repo';

export default function TodayWidget() {
  const data = useLiveQuery(async () => {
    const entries = await entryRepo.active().toArray();
    const projects = await projectRepo.active().toArray();
    return { entries, projects };
  }, []);
  const day = today();
  const minutes = data
    ? totalsByProject(data.entries, day, day, now()).reduce((s, x) => s + x.minutes, 0)
    : 0;
  const running = data ? runningEntry(data.entries) : undefined;
  const name = running ? data?.projects.find((p) => p.id === running.projectId)?.name : undefined;
  return (
    <WidgetList
      emptyAction={{ label: t.homeEmpty.timetrack, to: '/timetrack?new=1' }}
      loading={!data}
      empty={data && !running && minutes === 0 ? t.timetrack.widgetIdle : undefined}
      headline={
        running
          ? t.timetrack.widgetRunning(name ?? '')
          : minutes > 0
            ? t.timetrack.widgetToday(formatMinutes(minutes))
            : undefined
      }
      entries={[]}
      to="/timetrack"
      linkLabel={t.timetrack.title}
    />
  );
}
