import { useLiveQuery } from 'dexie-react-hooks';
import { useNow } from '@/core/focus/useNow';
import { today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, KpiWidget, WidgetBody } from '@/ui';
import { duration } from '../components/format';
import { runningSeconds, runningSession, sessionMinutes, stopwatch } from '../logic';
import { jobRepo, sessionRepo, startSession, stopSession } from '../repo';

/** What runs right now (or today's total) with one button: Stopp, or Start for the last used project. */
export default function TimerWidget() {
  const nowMs = useNow(30_000);
  const data = useLiveQuery(async () => {
    const day = today();
    const sessions = (await sessionRepo.active().toArray()).filter(
      (s) => s.date === day || !s.endTime,
    );
    const jobs = (await jobRepo.active().sortBy('order')).filter((j) => !j.archived);
    return { sessions, jobs };
  }, []);
  if (!data) return null;
  const running = runningSession(data.sessions);
  const total = data.sessions.reduce((sum, s) => sum + sessionMinutes(s, nowMs), 0);
  if (data.jobs.length === 0)
    return (
      // C34: the shared widget empty state (the fish, one sentence, one next step), like every other widget.
      <WidgetBody
        loading={false}
        isEmpty
        empty={t.timetrack.widgetText.none}
        emptyAction={{ label: t.timetrack.widgetText.addJob, to: '/timetrack?view=jobs' }}
      >
        {null}
      </WidgetBody>
    );
  if (running) {
    const job = data.jobs.find((j) => j.id === running.jobId);
    return (
      <>
        <KpiWidget
          loading={false}
          label={job?.name ?? t.timetrack.noJob}
          value={stopwatch(runningSeconds(running, nowMs), false)}
          context={`${t.timetrack.widgetText.running(job?.name ?? t.timetrack.noJob, running.startTime)} · ${t.timetrack.todayTotal(duration(total))}`}
        />
        <Button size="sm" variant="primary" onClick={() => void stopSession(running)}>
          {t.timetrack.stop}
        </Button>
      </>
    );
  }
  const first = data.jobs[0]!;
  return (
    <>
      {/* U30: the figure is today's total; one context line says what it is and that nothing runs. */}
      <KpiWidget
        loading={false}
        value={stopwatch(total * 60, false)}
        context={t.timetrack.widgetText.idle}
      />
      <Button
        size="sm"
        onClick={() =>
          void startSession(first.id).then(() =>
            useUiStore.getState().toast(t.timetrack.startedToast(first.name)),
          )
        }
      >
        {t.timetrack.startFor(first.name)}
      </Button>
    </>
  );
}
