import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useNow } from '@/core/focus/useNow';
import { formatMoney } from '@/core/money';
import { addDaysStr, today } from '@/core/time/dates';
import { changeWithUndo } from '@/core/undo/withToast';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import {
  Button,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  Segmented,
  categoryColor,
  useMediaQuery,
  useOpenParam,
} from '@/ui';
import { HeroFigure, HeroSlot, SignatureMark } from '@/ui/identity';
import { IdlePrompt } from '../components/IdlePrompt';
import { JobEditor, type JobTarget } from '../components/JobEditor';
import { Report } from '../components/Report';
import { TimerHead } from '../components/TimerHead';
import { RunningCard } from '../components/RunningCard';
import { SessionEditor, type SessionTarget } from '../components/SessionEditor';
import { duration } from '../components/format';
import { useClients, useJobs, useSessions } from '../data';
import { runningSeconds, runningSession, sessionMinutes, stopwatch } from '../logic';
import { jobRepo, sessionRepo, startSession } from '../repo';
import styles from '../timetrack.module.css';

const VIEWS = ['today', 'report', 'jobs'] as const;
type View = (typeof VIEWS)[number];

export default function TimetrackPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('view');
  const view: View = (VIEWS as readonly string[]).includes(raw ?? '') ? (raw as View) : 'today';
  const jobs = useJobs(false);
  const archived = useJobs(true);
  const clients = useClients();
  const day = today();
  const sessions = useSessions(addDaysStr(day, -70));
  const [session, setSession] = useState<SessionTarget>(null);
  const [job, setJob] = useState<JobTarget>(null);
  useOpenParam(
    (id) => sessionRepo.get(id),
    (s) => setSession(s),
  );

  const running = runningSession(sessions ?? []);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const nowMs = useNow(reduced ? 30_000 : 1000, Boolean(running) && !running?.pausedAt);
  const jobMap = useMemo(
    () => new Map((jobs ?? []).concat(archived ?? []).map((j) => [j.id, j])),
    [jobs, archived],
  );
  const todays = (sessions ?? []).filter((s) => s.date === day);
  const todayMinutes = todays.reduce((sum, s) => sum + sessionMinutes(s, nowMs), 0);

  // `?new=1` (Quick-Add) opens the manual entry; closing it drops the parameter.
  const openSession: SessionTarget = session ?? (params.get('new') ? 'new' : null);
  const closeSession = () => {
    setSession(null);
    if (params.get('new')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  };
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'today') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  async function start(id: string, name: string) {
    await startSession(id);
    useUiStore.getState().toast(t.timetrack.startedToast(name));
  }

  const runJob = running?.jobId ? jobMap.get(running.jobId) : undefined;
  const figure = running
    ? stopwatch(runningSeconds(running, nowMs), !reduced)
    : stopwatch(todayMinutes * 60, false);

  return (
    <>
      <PageHeader
        title={t.timetrack.title}
        views={
          <Segmented
            label={t.timetrack.tabs.label}
            value={view}
            options={VIEWS.map((v) => ({ value: v, label: t.timetrack.tabs[v] }))}
            onChange={setView}
          />
        }
      >
        {/* C29: Start/Stopp in the head is the page's one filled action; adding a past entry is secondary. */}
        <Button onClick={() => setSession('new')}>
          <Icon name="plus" size={18} />
          {t.timetrack.add}
        </Button>
      </PageHeader>
      <HeroSlot area="figure">
        <HeroFigure
          type="mono"
          testId="timetrack-figure"
          label={running ? (runJob?.name ?? t.timetrack.running) : t.timetrack.head.idle}
          value={figure}
          detail={
            running
              ? `${running.pausedAt ? `${t.timetrack.paused} · ` : ''}${t.timetrack.since(running.startTime)}`
              : t.timetrack.todayTotal(duration(todayMinutes))
          }
        />
      </HeroSlot>

      {running ? <IdlePrompt session={running} /> : null}

      <TimerHead
        sessions={todays}
        running={running}
        firstJob={(jobs ?? [])[0]}
        showStop={view !== 'today'}
      />

      {view === 'today' ? (
        <>
          {running ? (
            <RunningCard session={running} job={runJob} />
          ) : (
            <p className={styles.meta}>{t.timetrack.idleNow}</p>
          )}
          {jobs && jobs.length === 0 ? (
            <EmptyState
              title={t.timetrack.emptyJobs}
              testId="timetrack-empty"
              motif={<SignatureMark id="hourStrip" size={64} />}
            >
              <Button variant="primary" onClick={() => setJob('new')}>
                {t.timetrack.job.add}
              </Button>
            </EmptyState>
          ) : (
            <div className={styles.starts} role="group" aria-label={t.timetrack.start}>
              {(jobs ?? []).map((j) => (
                <button
                  key={j.id}
                  type="button"
                  className={styles.tile}
                  aria-label={t.timetrack.startFor(j.name)}
                  onClick={() => void start(j.id, j.name)}
                >
                  <span
                    className={styles.dot}
                    style={{ background: categoryColor(j.tone) }}
                    aria-hidden="true"
                  />
                  <Icon name="play" size={16} />
                  {j.name}
                </button>
              ))}
            </div>
          )}
          {todays.length === 0 ? (
            <p>{t.timetrack.noSessions}</p>
          ) : (
            <ItemList>
              {todays.map((s) => {
                const j = s.jobId ? jobMap.get(s.jobId) : undefined;
                return (
                  <ItemRow
                    key={s.id}
                    title={j?.name ?? s.note ?? t.timetrack.noJob}
                    meta={`${s.startTime} – ${s.endTime ?? '…'} · ${duration(sessionMinutes(s, nowMs))}`}
                    lead={
                      <span
                        className={styles.dot}
                        style={{ background: categoryColor(j?.tone ?? 0) }}
                        aria-hidden="true"
                      />
                    }
                    onOpen={() => setSession(s)}
                  />
                );
              })}
            </ItemList>
          )}
        </>
      ) : null}

      {view === 'report' ? (
        <Report
          sessions={sessions ?? []}
          jobs={[...(jobs ?? []), ...(archived ?? [])]}
          clients={clients ?? []}
        />
      ) : null}

      {view === 'jobs' ? (
        <>
          <Button variant="secondary" onClick={() => setJob('new')}>
            <Icon name="plus" size={18} />
            {t.timetrack.job.add}
          </Button>
          <ItemList>
            {[...(jobs ?? []), ...(archived ?? [])].map((j) => {
              const client = (clients ?? []).find((c) => c.id === j.clientId);
              const bits = [
                client?.name,
                j.rateCents && j.billable
                  ? t.timetrack.job.rateLine(formatMoney(j.rateCents))
                  : undefined,
                !j.billable ? t.timetrack.job.notBillable : undefined,
                j.archived ? t.timetrack.job.archived : undefined,
              ].filter(Boolean);
              return (
                <ItemRow
                  key={j.id}
                  title={j.name}
                  meta={bits.join(' · ')}
                  lead={
                    <span
                      className={styles.dot}
                      style={{ background: categoryColor(j.tone) }}
                      aria-hidden="true"
                    />
                  }
                  onOpen={() => setJob(j)}
                  end={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void changeWithUndo(
                          () => jobRepo.update(j.id, { archived: j.archived ? undefined : true }),
                          j.archived ? undefined : t.timetrack.job.archived,
                        )
                      }
                    >
                      {j.archived ? t.timetrack.job.restore : t.timetrack.job.archive}
                    </Button>
                  }
                />
              );
            })}
          </ItemList>
        </>
      ) : null}

      <SessionEditor target={jobs ? openSession : null} jobs={jobs ?? []} onClose={closeSession} />
      <JobEditor
        target={job}
        clients={clients ?? []}
        nextOrder={(jobs?.length ?? 0) + 1}
        onClose={() => setJob(null)}
      />
    </>
  );
}
