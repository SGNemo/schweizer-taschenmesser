/**
 * Recurring-payment detection on bank transactions: the same payee, at least three debits, a
 * regular interval (weekly … yearly) and a stable amount. Pure; produces suggestions the user
 * confirms in the import preview.
 */
import type { BankTransaction } from './bank';

export interface DetectedSubscription {
  /** Normalised payee key, also the duplicate key of the suggestion. */
  key: string;
  payee: string;
  /** Positive cents of the latest charge. */
  amountMinor: number;
  /** Charge interval. */
  freq: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  /** Median gap in days between charges. */
  intervalDays: number;
  /** Booking date of the latest charge. */
  lastDate: string;
  /** Next expected charge ('YYYY-MM-DD'). */
  nextDate: string;
  occurrences: number;
}

/** Candidate rhythms with the tolerance (days) around the median gap. */
const RHYTHMS: { freq: DetectedSubscription['freq']; days: number; tolerance: number }[] = [
  { freq: 'weekly', days: 7, tolerance: 1 },
  { freq: 'monthly', days: 30.4, tolerance: 4 },
  { freq: 'quarterly', days: 91, tolerance: 8 },
  { freq: 'yearly', days: 365, tolerance: 14 },
];

const MS_DAY = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / MS_DAY);
const dateOf = (n: number) => new Date(n * MS_DAY).toISOString().slice(0, 10);

/** "NETFLIX.COM 123456 LU" → "netflix.com": lower case, digits and noise words dropped. */
export function payeeKey(payee: string): string {
  return payee
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/\b(gmbh|ag|se|kg|ltd|inc|llc|sarl|s\.a\.r\.l|lu|de|eu|europe|sepa|dd)\b/g, ' ')
    .replace(/[^a-zäöüß.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function detectSubscriptions(
  transactions: readonly BankTransaction[],
): DetectedSubscription[] {
  const groups = new Map<string, BankTransaction[]>();
  for (const t of transactions) {
    if (t.amountMinor >= 0) continue; // only money that left the account
    const key = payeeKey(t.payee);
    if (key.length < 3) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const found: DetectedSubscription[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((t, i) => dayNumber(t.date) - dayNumber(sorted[i]!.date));
    if (gaps.some((g) => g === 0) && sorted.length - gaps.filter((g) => g === 0).length < 3)
      continue;
    const mid = median(gaps.filter((g) => g > 0));
    const rhythm = RHYTHMS.find((r) => Math.abs(mid - r.days) <= r.tolerance);
    if (!rhythm) continue;
    // Most gaps must follow the rhythm, not just their median.
    const regular = gaps.filter((g) => Math.abs(g - rhythm.days) <= rhythm.tolerance * 2).length;
    if (regular / gaps.length < 0.75) continue;
    const amounts = sorted.map((t) => Math.abs(t.amountMinor));
    const typical = median(amounts);
    if (amounts.some((a) => Math.abs(a - typical) > typical * 0.1)) continue;
    const last = sorted[sorted.length - 1]!;
    found.push({
      key,
      payee: last.payee,
      amountMinor: Math.abs(last.amountMinor),
      freq: rhythm.freq,
      intervalDays: Math.round(mid),
      lastDate: last.date,
      nextDate: dateOf(dayNumber(last.date) + Math.round(rhythm.days)),
      occurrences: sorted.length,
    });
  }
  return found.sort((a, b) => b.amountMinor - a.amountMinor);
}
