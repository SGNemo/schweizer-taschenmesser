const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const nf = (digits: number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Windows-style sizes: powers of 1024, labelled KB/MB/GB. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${nf(i === 0 || v >= 100 ? 0 : 1).format(v)} ${units[i]}`;
}

export const formatCount = (n: number): string => new Intl.NumberFormat('de-DE').format(n);

/** Whole percent 0–100 (clamped); 0 when `total` is 0. */
export function percent(part: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}

/** Fill level of a drive: `full` from 90 %, `tight` from 75 %. */
export type DriveLevel = 'ok' | 'tight' | 'full';
export const driveLevel = (usedPercent: number): DriveLevel =>
  usedPercent >= 90 ? 'full' : usedPercent >= 75 ? 'tight' : 'ok';

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 1) return '< 1 s';
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** 273420 → "3 Tage 4 Std." (whole units, the two biggest that are not zero). */
export function formatUptime(secs: number): { days: number; hours: number; minutes: number } {
  const s = Math.max(0, Math.floor(secs));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
  };
}
