import { t } from '@/strings';
import type { SkipCounts } from './types';

/** Readable lines for the import report: one per reason that occurred, in a fixed order. */
export function skipNotes(counts: SkipCounts): string[] {
  const reasons = t.importers.reasons;
  return (Object.keys(reasons) as (keyof typeof reasons)[])
    .filter((key) => (counts[key] ?? 0) > 0)
    .map((key) => reasons[key](counts[key]!));
}

export function sumSkips(counts: SkipCounts): number {
  return Object.values(counts).reduce((n, v) => n + (v ?? 0), 0);
}
