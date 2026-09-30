import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatDay, today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  ItemList,
  ItemRow,
  PageHeader,
  SelectField,
  Stat,
} from '@/ui';
import { EntryEditor, type EntryTarget } from '../components/EntryEditor';
import { ExportDialog } from '../components/ExportDialog';
import { ProjectsDialog } from '../components/ProjectsDialog';
import {
  elapsedMinutes,
  formatClock,
  formatDecimalHours,
  formatMinutes,
  groupByDate,
  isRunning,
  minutesOf,
  runningEntry,
  totalsByProject,
  weekBounds,
} from '../logic';
import { entryRepo, projectRepo } from '../repo';
import styles from '@/pages/Page.module.css';

export default function TimetrackPage() {
  const projects = useLiveQuery(() => projectRepo.active().toArray(), []);
  const entries = useLiveQuery(() => entryRepo.active().toArray(), []);
  const [target, setTarget] = useState<EntryTarget>(null);
  const [showProjects, setShowProjects] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [pick, setPick] = useState('');
  const [tick, setTick] = useState(() => now());
  const [params, setParams] = useSearchParams();

  const active = useMemo(
    () =>
      (projects ?? [])
        .filter((p) => !p.archived)
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [projects],
  );
  const names = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p.name])), [projects]);
  const running = runningEntry(entries ?? []);

  // Only while a timer runs does the page need a clock.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const openTarget =
    target ?? (params.get('new') && active.length > 0 ? { draft: true as const } : null);
  const close = () => {
    setTarget(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  const day = today();
  const week = weekBounds(day);
  const weekTotals = totalsByProject(entries ?? [], week.from, week.to, tick);
  const weekSum = weekTotals.reduce((s, x) => s + x.minutes, 0);
  const todaySum = totalsByProject(entries ?? [], day, day, tick).reduce(
    (s, x) => s + x.minutes,
    0,
  );
  const groups = groupByDate((entries ?? []).filter((e) => !isRunning(e))).slice(0, 30);
  const projectId = pick && active.some((p) => p.id === pick) ? pick : (active[0]?.id ?? '');

  async function start() {
    if (!projectId || running) return;
    await entryRepo.create({ projectId, date: day, minutes: 0, startedAt: now() });
  }
  async function stop() {
    if (!running || typeof running.startedAt !== 'number') return;
    await entryRepo.update(running.id, {
      minutes: Math.min(1440, elapsedMinutes(running.startedAt, now())),
      startedAt: null,
    });
  }

  return (
    <>
      <PageHeader title={t.timetrack.title}>
        <Button onClick={() => setShowProjects(true)}>{t.timetrack.projects}</Button>
      </PageHeader>

      <Card>
        {running && typeof running.startedAt === 'number' ? (
          <div role="timer" aria-label={t.timetrack.running} data-testid="running">
            <p className={styles.lead}>
              {t.timetrack.running}: <strong>{names.get(running.projectId) ?? ''}</strong>{' '}
              {t.timetrack.runningSince(new Date(running.startedAt).toTimeString().slice(0, 5))}
            </p>
            <p
              style={{
                fontSize: '2.25rem',
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 650,
                margin: 'var(--space-2) 0',
              }}
            >
              {formatClock(tick - running.startedAt)}
            </p>
            <Button variant="danger" onClick={() => void stop()}>
              {t.timetrack.stop}
            </Button>
          </div>
        ) : active.length === 0 ? (
          <EmptyState icon="clock" title={t.timetrack.noProject}>
            <Button variant="primary" onClick={() => setShowProjects(true)}>
              {t.timetrack.newProject}
            </Button>
          </EmptyState>
        ) : (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 12rem' }}>
              <SelectField
                label={t.timetrack.project}
                value={projectId}
                onChange={(e) => setPick(e.target.value)}
              >
                {active.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <Button variant="primary" onClick={() => void start()}>
              <Icon name="play" size={18} />
              {t.timetrack.start}
            </Button>
          </div>
        )}
      </Card>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          margin: 'var(--space-4) 0',
        }}
      >
        <Button onClick={() => setTarget({ draft: true })} disabled={active.length === 0}>
          <Icon name="plus" size={18} />
          {t.timetrack.addEntry}
        </Button>
        <Button onClick={() => setShowExport(true)} disabled={(entries ?? []).length === 0}>
          <Icon name="download" size={18} />
          {t.timetrack.export}
        </Button>
      </div>

      {entries && entries.length > 0 ? (
        <>
          <Card title={t.timetrack.week}>
            <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
              <Stat
                label={t.timetrack.today}
                value={t.timetrack.hours(formatMinutes(todaySum))}
                testId="today-total"
              />
              <Stat
                label={t.timetrack.total}
                value={t.timetrack.hours(formatMinutes(weekSum))}
                testId="week-total"
              />
            </div>
            <ul className={styles.list} style={{ marginTop: 'var(--space-3)' }}>
              {weekTotals.map((x) => (
                <li key={x.projectId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{names.get(x.projectId) ?? '—'}</span>
                  <span>
                    {t.timetrack.hours(formatMinutes(x.minutes))} · {formatDecimalHours(x.minutes)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          {groups.map((g) => (
            <section
              key={g.date}
              aria-label={formatDay(g.date, 'dd.MM.yyyy')}
              className={styles.section}
            >
              <h2>{formatDay(g.date, 'EEEE, dd.MM.yyyy')}</h2>
              <ItemList label={g.date}>
                {g.entries.map((e) => (
                  <ItemRow
                    key={e.id}
                    title={`${names.get(e.projectId) ?? '—'} · ${t.timetrack.hours(formatMinutes(minutesOf(e, tick)))}`}
                    meta={e.note}
                    onOpen={() => setTarget(e)}
                  />
                ))}
              </ItemList>
            </section>
          ))}
        </>
      ) : entries ? (
        <p className={styles.lead}>{t.timetrack.empty}</p>
      ) : null}

      <EntryEditor target={openTarget} projects={active} onClose={close} />
      <ProjectsDialog
        open={showProjects}
        projects={projects ?? []}
        onClose={() => setShowProjects(false)}
      />
      <ExportDialog
        open={showExport}
        entries={entries ?? []}
        projects={projects ?? []}
        onClose={() => setShowExport(false)}
      />
    </>
  );
}
