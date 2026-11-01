import { formatNumber, formatTimestamp } from '@/core/i18n/format';

/** "812 KB", "14,3 MB": the size of a region in the UI language's number format. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
}

/** The build date of a region, date only. */
export const formatBuiltAt = (at: number): string => formatTimestamp(at, { dateStyle: 'medium' });
