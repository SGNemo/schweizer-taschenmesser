/**
 * Local password check: reuse, age and (through `measureStrength`) strength. Pure functions over the
 * decrypted entries; the result holds entry ids only, never a password. Nothing here stores or sends anything (the optional leak check lives in `breach.ts`).
 */
import { daysBetween } from '@/core/time/dates';
import type { EntryData } from './schema';

export interface AuditEntry {
  id: string;
  data: Pick<EntryData, 'title' | 'password' | 'changedAt'>;
}

/** A password this many days old or older gets the age hint. */
export const OLD_AFTER_DAYS = 365;

/** Groups of entry ids that share the same non-empty password (only groups of two or more). */
export function findReused(entries: readonly AuditEntry[]): string[][] {
  const byPassword = new Map<string, string[]>();
  for (const e of entries) {
    if (!e.data.password) continue;
    const ids = byPassword.get(e.data.password);
    if (ids) ids.push(e.id);
    else byPassword.set(e.data.password, [e.id]);
  }
  return [...byPassword.values()].filter((ids) => ids.length > 1);
}

/** Entries whose password was last changed long ago; entries without a date are not guessed at. */
export function findOld(
  entries: readonly AuditEntry[],
  today: string,
  days: number = OLD_AFTER_DAYS,
): string[] {
  return entries
    .filter(
      (e) => e.data.password && e.data.changedAt && daysBetween(e.data.changedAt, today) >= days,
    )
    .map((e) => e.id);
}
