const units = ['B', 'KB', 'MB', 'GB', 'TB'];
const nf = (d: number) =>
  new Intl.NumberFormat('de-DE', { maximumFractionDigits: d, minimumFractionDigits: 0 });

/** Windows-style sizes: powers of 1024 labelled KB/MB/GB. */
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

export function percent(part: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
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
