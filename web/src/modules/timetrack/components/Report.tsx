import { useMemo, useState } from 'react';
import type { Stored } from '@/core/db/types';
import { dateTimeFormat } from '@/core/i18n/format';
import { formatMoney } from '@/core/money';
import { getPlatform } from '@/core/platform';
import { useWeekStart } from '@/core/settings/core';
import { today } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Icon, Progress } from '@/ui';
import { rangeOf, report, sessionMinutes, shiftPeriod, toCsv, type Period } from '../logic';
import type { Client, Job, Session } from '../schema';
import { duration } from './format';
import styles from '../timetrack.module.css';

/** Week / month: totals, bars per project and client, amount, CSV. */
export function Report({
  sessions,
  jobs,
  clients,
}: {
  sessions: readonly Stored<Session>[];
  jobs: readonly Stored<Job>[];
  clients: readonly Stored<Client>[];
}) {
  const weekStart = useWeekStart();
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(today());
  const { from, to } = rangeOf(period, anchor, weekStart === 7 ? 7 : 1);
  const nowMs = now();
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const labels = { noJob: t.timetrack.noJob, noClient: t.timetrack.noClient };
  const r = report(sessions, jobMap, clientMap, from, to, nowMs, labels);
  const fmt = dateTimeFormat({ day: 'numeric', month: 'short' });
  const range = `${fmt.format(new Date(`${from}T12:00`))} – ${fmt.format(new Date(`${to}T12:00`))}`;
  const hasRates = r.cents > 0;

  async function exportCsv() {
    const rows = sessions
      .filter((s) => s.date >= from && s.date <= to)
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      .map((s) => {
        const job = s.jobId ? jobMap.get(s.jobId) : undefined;
        const minutes = sessionMinutes(s, nowMs);
        return {
          date: s.date,
          start: s.startTime,
          end: s.endTime ?? '',
          breakMin: s.breakMin,
          minutes,
          project: job?.name ?? '',
          client: job?.clientId ? (clientMap.get(job.clientId)?.name ?? '') : '',
          billable: job?.billable !== false,
          ratePerHour: job?.rateCents,
          cents: job?.billable && job.rateCents ? Math.round((minutes * job.rateCents) / 60) : 0,
          note: s.note ?? '',
        };
      });
    const res = await getPlatform().saveFile({
      fileName: `timetrack-${from}_${to}.csv`,
      data: toCsv(rows),
      mime: 'text/csv',
    });
    if (res === 'saved') useUiStore.getState().toast(t.timetrack.report.csvDone);
  }

  const list = (title: string, lines: typeof r.byJob) => (
    <>
      <h2 className={styles.section}>{title}</h2>
      <ul className={styles.bars}>
        {lines.map((l) => (
          <li key={l.key}>
            <div className={styles.barHead}>
              <span>{l.name}</span>
              <span>
                {duration(l.minutes)}
                {l.cents > 0 ? ` · ${formatMoney(l.cents)}` : ''}
              </span>
            </div>
            <Progress value={l.minutes} max={r.minutes} label={l.name} />
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div data-testid="report">
      <div className={styles.periodBar} role="group" aria-label={t.timetrack.report.period}>
        {(['week', 'month'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={styles.chip}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {t.timetrack.report[p]}
          </button>
        ))}
        {/* One group that never breaks: the arrow after the range must not land on a line of its own. */}
        <span className={styles.rangeStep}>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t.timetrack.report.prev}
            onClick={() => setAnchor((a) => shiftPeriod(period, a, -1))}
          >
            <Icon name="chevronLeft" size={18} />
          </Button>
          <span>{range}</span>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t.timetrack.report.next}
            onClick={() => setAnchor((a) => shiftPeriod(period, a, 1))}
          >
            <Icon name="chevronRight" size={18} />
          </Button>
        </span>
      </div>
      {r.minutes === 0 ? (
        <p>{t.timetrack.report.none}</p>
      ) : (
        <>
          <ul className={styles.totals}>
            <li>
              <span className={styles.meta}>{t.timetrack.report.total}</span>
              <strong data-testid="report-total">{duration(r.minutes)}</strong>
            </li>
            <li>
              <span className={styles.meta}>{t.timetrack.report.billable}</span>
              <strong>{duration(r.billableMinutes)}</strong>
            </li>
            {hasRates ? (
              <li>
                <span className={styles.meta}>{t.timetrack.report.amount}</span>
                <strong data-testid="report-amount">{formatMoney(r.cents)}</strong>
              </li>
            ) : null}
          </ul>
          {list(t.timetrack.report.byJob, r.byJob)}
          {r.byClient.length > 1 || r.byClient[0]?.key
            ? list(t.timetrack.report.byClient, r.byClient)
            : null}
          {hasRates ? <p className={styles.meta}>{t.timetrack.report.roundNote}</p> : null}
          <Button variant="secondary" onClick={() => void exportCsv()}>
            <Icon name="download" size={18} />
            {t.timetrack.report.csv}
          </Button>
        </>
      )}
    </div>
  );
}
