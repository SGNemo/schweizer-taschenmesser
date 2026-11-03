import { numberFormat } from '@/core/i18n/format';

const units = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Sizes in powers of 1024, labelled KB/MB/GB like the system does. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : 1;
  return `${numberFormat({ maximumFractionDigits: digits }).format(v)} ${units[i]}`;
}

/** Whole percent 0–100; 0 while the total is unknown. */
export function percent(done: number, total: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

/** Only these jobs show in the widget: still to do. */
export const isActive = (state: string): boolean =>
  state === 'running' || state === 'queued' || state === 'paused';

/** "45 s", "12 min", "2 h 5 min": a short remaining time in the UI language's own unit names. */
export function formatEta(seconds: number): string {
  const unit = (n: number, u: 'second' | 'minute' | 'hour') =>
    numberFormat({
      style: 'unit',
      unit: u,
      unitDisplay: 'narrow',
      maximumFractionDigits: 0,
    }).format(n);
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return unit(s, 'second');
  const min = Math.round(s / 60);
  if (min < 60) return unit(min, 'minute');
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? unit(h, 'hour') : `${unit(h, 'hour')} ${unit(rest, 'minute')}`;
}

/** Seconds left for a running job, or `null` when the speed or the total is unknown. */
export function etaSeconds(job: {
  state: string;
  done: number;
  total: number | null;
  speedBps: number;
}): number | null {
  if (job.state !== 'running' || !job.total || job.speedBps <= 0) return null;
  return Math.max(0, (job.total - job.done) / job.speedBps);
}

export type JobFilter = 'all' | 'active' | 'done' | 'problems';

export const matchesFilter = (state: string, filter: JobFilter): boolean =>
  filter === 'all' ||
  (filter === 'active' && isActive(state)) ||
  (filter === 'done' && state === 'done') ||
  (filter === 'problems' && state === 'failed');

/** Summary of what is running: how many, the share done of all jobs with a known size, the total speed. */
export function bandSummary(
  jobs: readonly { state: string; done: number; total: number | null; speedBps: number }[],
): { running: number; percent: number; speedBps: number } {
  const active = jobs.filter((j) => isActive(j.state));
  const sized = active.filter((j) => j.total && j.total > 0);
  const total = sized.reduce((sum, j) => sum + (j.total ?? 0), 0);
  const done = sized.reduce((sum, j) => sum + Math.min(j.done, j.total ?? 0), 0);
  return {
    running: active.filter((j) => j.state === 'running').length,
    percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
    speedBps: active.reduce((sum, j) => sum + (j.state === 'running' ? j.speedBps : 0), 0),
  };
}
