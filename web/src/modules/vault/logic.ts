import { compareText } from '@/core/i18n/format';
import { minusNotice } from '@/core/deadline/notice';
import { addDaysStr, addMonthsStr, daysBetween } from '@/core/time/dates';
import type { DocCategory, VaultDocument } from './schema';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

type D = Pick<VaultDocument, 'endDate' | 'expiresOn' | 'noticeDays' | 'noticeMonths'>;

/** End date of a document; `expiresOn` is what documents carried before 0.6.0. */
export const endOf = (d: Pick<VaultDocument, 'endDate' | 'expiresOn'>): string | undefined =>
  d.endDate ?? d.expiresOn;

/** Last day to cancel; only for entries with an end date and a notice period. */
export function cancelDeadline(d: D): string | undefined {
  const end = endOf(d);
  return end && d.noticeDays !== undefined
    ? minusNotice(end, { days: d.noticeDays, months: d.noticeMonths })
    : undefined;
}

export type Status = 'expired' | 'act-now' | 'missed' | 'soon' | 'ok' | 'open-ended';

/** The three states the head's folder tabs count and filter by: expired, a deadline in sight, fine. */
export type StateGroup = 'expired' | 'due' | 'ok';
export const STATE_GROUPS: readonly StateGroup[] = ['expired', 'due', 'ok'];
export function stateGroup(s: Status): StateGroup {
  // A passed cancellation deadline is no deadline "in sight" any more: the term simply runs on.
  return s === 'expired' ? 'expired' : s === 'act-now' || s === 'soon' ? 'due' : 'ok';
}

/** Days before a cancellation deadline from which an entry counts as "soon". */
export const SOON_DAYS = 30;
/** Days before the end of a document without a deadline (passport, warranty) that count as "soon". */
export const EXPIRY_SOON_DAYS = 60;

/**
 * - expired: the end date has passed
 * - act-now: the cancellation deadline is today or within 7 days (and not yet passed)
 * - missed: the cancellation deadline has passed but the contract has not ended yet (it runs on)
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
  if (deadline) return 'missed';
  const days = daysBetween(today, end);
  return days <= EXPIRY_SOON_DAYS ? 'soon' : 'ok';
}

/** The date that matters next: the deadline while it lies ahead, otherwise the end. */
export function nextRelevantDate(d: D, today: string): string | undefined {
  const deadline = cancelDeadline(d);
  if (deadline && deadline >= today) return deadline;
  return endOf(d);
}

const RANK: Record<Status, number> = {
  'act-now': 0,
  expired: 1,
  missed: 2,
  soon: 3,
  ok: 4,
  'open-ended': 5,
};

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
    return da.localeCompare(db) || compareText(a.title, b.title);
  });
}

/** Keeps a download name safe for file systems. */
export const safeFileName = (name: string): string => name.replace(/[\\/:*?"<>|]+/g, '_');

/** Ready-made papers the start-data wizard offers (texts live in `strings.ts`, category per paper). */
export const PAPER_TEMPLATES = [
  'passport',
  'idCard',
  'license',
  'vehicleInspection',
  'healthCard',
  'vaccination',
  'rental',
  'policies',
] as const;
export type PaperTemplate = (typeof PAPER_TEMPLATES)[number];

/**
 * Categories with a "Verlängert" button: whatever is renewed rather than replaced (a contract, an insurance, a
 * passport, the vehicle inspection under "Sonstiges"). A warranty ends; a tax paper has no term.
 */
export const RENEWABLE: readonly DocCategory[] = [
  'identity',
  'insurance',
  'contract',
  'health',
  'other',
];

/** "Verlängert" is offered once the end has come or the cancellation deadline is here or gone. */
export function canRenew(d: Pick<VaultDocument, 'category'>, state: Status): boolean {
  return (
    RENEWABLE.includes(d.category) &&
    (state === 'expired' || state === 'act-now' || state === 'missed')
  );
}

/** Whole months from `from` to `to` when `to` is exactly that many months later; otherwise undefined. */
function wholeMonths(from: string, to: string): number | undefined {
  const n =
    (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
    Number(to.slice(5, 7)) -
    Number(from.slice(5, 7));
  return n >= 1 && addMonthsStr(from, n) === to ? n : undefined;
}

/**
 * The end date "Verlängert" proposes: one more term of the same length. The term runs from `startDate` to the end
 * inclusive; in whole months when it is that (1 Jan – 31 Dec → 31 Dec of the next year, 1 Feb – 28 Feb → 31 Mar),
 * otherwise in days. Without a start (a passport, the vehicle inspection: only an end) nothing is proposed.
 */
export function renewedEnd(
  d: Pick<VaultDocument, 'startDate' | 'endDate' | 'expiresOn'>,
): string | undefined {
  const end = endOf(d);
  if (!end || !d.startDate || d.startDate > end) return undefined;
  const next = addDaysStr(end, 1);
  const months = wholeMonths(d.startDate, next);
  const after = months
    ? addMonthsStr(next, months)
    : addDaysStr(next, daysBetween(d.startDate, next));
  return addDaysStr(after, -1);
}

/**
 * What a renewal writes: the new end, and the new term's first day in place of the old start (so the next
 * renewal proposes one term again, not two). A document without a start keeps none.
 */
export function renewPatch(
  d: Pick<VaultDocument, 'startDate' | 'endDate' | 'expiresOn'>,
  newEnd: string,
): Pick<VaultDocument, 'startDate' | 'endDate' | 'expiresOn'> {
  const end = endOf(d);
  return {
    startDate: d.startDate && end ? addDaysStr(end, 1) : d.startDate,
    endDate: newEnd,
    expiresOn: undefined,
  };
}

/** One row of the "Fristen" timeline: a document and the date that matters next. */
export interface DeadlineRow<T> {
  doc: T;
  date: string;
  state: Status;
  /** What the date is: the last day to cancel, or the end. */
  kind: 'cancel' | 'end';
}

/** Every document with a date, oldest first: what has run out, then what comes. Undated ones are left out. */
export function deadlineRows<T extends VaultDocument>(
  docs: readonly T[],
  today: string,
): DeadlineRow<T>[] {
  return docs
    .flatMap((doc): DeadlineRow<T>[] => {
      const date = nextRelevantDate(doc, today);
      if (!date) return [];
      const deadline = cancelDeadline(doc);
      return [
        {
          doc,
          date,
          state: statusOf(doc, today),
          kind: deadline !== undefined && deadline >= today ? 'cancel' : 'end',
        },
      ];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || compareText(a.doc.title, b.doc.title));
}

/** Number of documents per category (for the folder tabs). */
export function countByCategory(
  docs: readonly Pick<VaultDocument, 'category'>[],
): Partial<Record<DocCategory, number>> {
  const out: Partial<Record<DocCategory, number>> = {};
  for (const d of docs) out[d.category] = (out[d.category] ?? 0) + 1;
  return out;
}
