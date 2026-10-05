import { extractAmount } from './amount';
import { extractDateTime } from './dates';
import { extractRecurrence } from './recurrence';
import type { CaptureNote, CaptureRecurrence } from './types';
import { startForRecurrence } from './index';
import { fmtDate, fromDate, take, type Scan } from './util';

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/i;

/** The facts a sentence carries, with their words cut out of `rest`. */
export interface ExtractedFacts {
  /** What is left of the text (not yet cleaned). */
  rest: string;
  url?: string;
  recurrence?: CaptureRecurrence;
  /** Integer cents, positive. */
  amountMinor?: number;
  kind?: 'expense' | 'income';
  /** 'YYYY-MM-DD' */
  date?: string;
  /** 'HH:mm' */
  time?: string;
  notes: CaptureNote[];
}

/**
 * Pulls URL, recurrence, amount, date and time out of free German text – the same extractors
 * `parseCapture` uses, without deciding what kind of entry it is. `bareAmount` also accepts a number
 * without a currency word ("auf 95").
 */
export function extractFacts(
  input: string,
  opts: { now: Date; bareAmount?: boolean },
): ExtractedFacts {
  const scan: Scan = { t: input };
  const out: ExtractedFacts = { rest: '', notes: [] };
  const url = take(scan, URL_RE)?.[0]?.replace(/[.,;:!?)]+$/, '');
  if (url) out.url = /^www\./i.test(url) ? `https://${url}` : url;
  const recurrence = extractRecurrence(scan);
  if (recurrence) out.recurrence = recurrence;
  let money = extractAmount(scan, false);
  const dt = extractDateTime(scan, opts.now);
  // A bare number is only an amount once dates and clock times are gone ("um 12", "15.10.").
  if (!money && opts.bareAmount) money = extractAmount(scan, true);
  if (money) {
    out.amountMinor = money.amountMinor;
    out.kind = money.kind;
  }
  // "jeden Montag" without a date starts at the next such day.
  const date =
    dt.date ?? (recurrence ? startForRecurrence(recurrence, fromDate(opts.now)) : undefined);
  if (date) out.date = fmtDate(date);
  if (dt.time !== undefined) out.time = dt.time;
  out.notes = [...dt.notes];
  out.rest = scan.t;
  return out;
}
