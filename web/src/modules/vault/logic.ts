import { daysBetween } from '@/core/time/dates';
import type { DocCategory, VaultDocument } from './schema';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export type ExpiryState = 'expired' | 'soon' | 'ok' | 'none';

export const EXPIRY_SOON_DAYS = 60;

export function expiryState(d: Pick<VaultDocument, 'expiresOn'>, today: string): ExpiryState {
  if (!d.expiresOn) return 'none';
  if (d.expiresOn < today) return 'expired';
  return daysBetween(today, d.expiresOn) <= EXPIRY_SOON_DAYS ? 'soon' : 'ok';
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterDocuments<T extends VaultDocument>(
  docs: readonly T[],
  opts: { category: DocCategory | 'all'; query: string },
): T[] {
  const q = fold(opts.query.trim());
  return docs
    .filter((d) => opts.category === 'all' || d.category === opts.category)
    .filter((d) => !q || fold(`${d.title} ${d.note ?? ''} ${d.fileName ?? ''}`).includes(q));
}

/** Expiring first (soonest), then the rest alphabetically. */
export function sortDocuments<T extends VaultDocument>(docs: readonly T[]): T[] {
  return [...docs].sort((a, b) => {
    if (a.expiresOn && b.expiresOn && a.expiresOn !== b.expiresOn)
      return a.expiresOn.localeCompare(b.expiresOn);
    if (!!a.expiresOn !== !!b.expiresOn) return a.expiresOn ? -1 : 1;
    return a.title.localeCompare(b.title, 'de');
  });
}

/** Keeps a download name safe for file systems. */
export const safeFileName = (name: string): string => name.replace(/[\\/:*?"<>|]+/g, '_');
