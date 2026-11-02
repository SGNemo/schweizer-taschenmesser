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
