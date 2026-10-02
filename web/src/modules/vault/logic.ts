import { addDaysStr, daysBetween } from '@/core/time/dates';
import type { DocCategory, VaultDocument } from './schema';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

type D = Pick<VaultDocument, 'endDate' | 'expiresOn' | 'noticeDays'>;

/** End date of a document; `expiresOn` is what documents carried before 0.6.0. */
export const endOf = (d: Pick<VaultDocument, 'endDate' | 'expiresOn'>): string | undefined =>
  d.endDate ?? d.expiresOn;

/** Last day to cancel; only for entries with an end date and a notice period. */
export function cancelDeadline(d: D): string | undefined {
  const end = endOf(d);
  return end && d.noticeDays !== undefined ? addDaysStr(end, -d.noticeDays) : undefined;
}

export type Status = 'expired' | 'act-now' | 'soon' | 'ok' | 'open-ended';

/** Days before a cancellation deadline from which an entry counts as "soon". */
export const SOON_DAYS = 30;
/** Days before the end of a document without a deadline (passport, warranty) that count as "soon". */
export const EXPIRY_SOON_DAYS = 60;

/**
 * - expired: the end date has passed
 * - act-now: the cancellation deadline is today or within 7 days (and not yet passed)
 * - soon: the deadline is within `SOON_DAYS`, or the end within `EXPIRY_SOON_DAYS` (no deadline)
 */
export function statusOf(d: D, today: string): Status {
  const end = endOf(d);
  if (!end) return 'open-ended';
  if (end < today) return 'expired';
  const deadline = cancelDeadline(d);
  if (deadline && deadline >= today) {
    const days = daysBetween(today, deadline);
    if (days <= 7) return 'act-now';
    return days <= SOON_DAYS ? 'soon' : 'ok';
  }
  const days = daysBetween(today, end);
  return days <= (deadline ? SOON_DAYS : EXPIRY_SOON_DAYS) ? 'soon' : 'ok';
}

/** The date that matters next: the deadline while it lies ahead, otherwise the end. */
export function nextRelevantDate(d: D, today: string): string | undefined {
  const deadline = cancelDeadline(d);
  if (deadline && deadline >= today) return deadline;
  return endOf(d);
}

const RANK: Record<Status, number> = { 'act-now': 0, expired: 1, soon: 2, ok: 3, 'open-ended': 4 };

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterDocuments<T extends VaultDocument>(
  docs: readonly T[],
  opts: { category: DocCategory | 'all'; query: string },
): T[] {
  const q = fold(opts.query.trim());
  return docs
    .filter((d) => opts.category === 'all' || d.category === opts.category)
    .filter(
      (d) =>
        !q ||
        fold(`${d.title} ${d.provider ?? ''} ${d.note ?? ''} ${d.fileName ?? ''}`).includes(q),
    );
}

/** Act now first, then expired, soon, ok (by the relevant date), open-ended last; ties alphabetical. */
export function sortDocuments<T extends VaultDocument>(docs: readonly T[], today: string): T[] {
  return [...docs].sort((a, b) => {
    const sa = statusOf(a, today);
    const sb = statusOf(b, today);
    if (RANK[sa] !== RANK[sb]) return RANK[sa] - RANK[sb];
    const da = nextRelevantDate(a, today) ?? '9999-12-31';
    const db = nextRelevantDate(b, today) ?? '9999-12-31';
    return da.localeCompare(db) || a.title.localeCompare(b.title, 'de');
  });
}

/** Keeps a download name safe for file systems. */
export const safeFileName = (name: string): string => name.replace(/[\\/:*?"<>|]+/g, '_');
