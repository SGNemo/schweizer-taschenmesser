import { useEffect } from 'react';
import { t } from '@/strings';
import { ProgressList } from '@/ui';
import { formatBytes, isActive, percent } from '../lib/format';
import { ensureWatching, useJobs } from '../store';

/** Downloads that are still to do: bar, percent and speed per file; names are the user's own. */
export default function RunningWidget() {
  useEffect(ensureWatching, []);
  const jobs = useJobs((s) => s.jobs);
  const open = (jobs ?? []).filter((j) => isActive(j.state));
  const running = open.filter((j) => j.state === 'running').length;
  return (
    <ProgressList
      loading={!jobs}
      empty={t.downloads.meta.widgetEmpty}
      emptyAction={{ label: t.downloads.meta.widgetAction, to: '/downloads?add=' }}
      summary={
        open.length ? t.downloads.meta.widgetSummary(running, open.length - running) : undefined
      }
      entries={open.map((j) => ({
        key: String(j.id),
        title: j.fileName,
        value: j.done,
        max: j.total ?? Math.max(j.done, 1),
        detail:
          `${j.total ? `${percent(j.done, j.total)} %` : formatBytes(j.done)}` +
          (j.state === 'running' && j.speedBps > 0
            ? ` · ${t.downloads.row.speed(formatBytes(j.speedBps))}`
            : ` · ${t.downloads.state[j.state]}`),
      }))}
    />
  );
}
