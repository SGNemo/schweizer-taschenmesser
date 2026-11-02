import { readStored, writeStored } from '../shared';

export interface HistoryEntry {
  expr: string;
  /** Result as shown (locale format) */
  result: string;
}

const KEY = 'tm-calc-history';
export const MAX_HISTORY = 100;

/**
 * The newest 100 calculations. The storage key is the one of the former calculator (it stays, see
 * brand-ids.test.ts); entries it wrote have a numeric result, new ones the result as shown.
 */
export function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(readStored(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const out: HistoryEntry[] = [];
    for (const e of parsed as Array<{ expr?: unknown; result?: unknown }>) {
      if (typeof e?.expr !== 'string') continue;
      if (typeof e.result === 'string') out.push({ expr: e.expr, result: e.result });
      else if (typeof e.result === 'number' && Number.isFinite(e.result)) {
        out.push({ expr: e.expr, result: String(e.result).replace('.', ',') });
      }
    }
    return out.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  writeStored(KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

/** Adds to the front; the same expression moves up instead of repeating. */
export function pushHistory(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...list.filter((h) => h.expr !== entry.expr)].slice(0, MAX_HISTORY);
}

/** Case-insensitive match on the expression or the result. */
export function searchHistory(list: HistoryEntry[], query: string): HistoryEntry[] {
  const q = query.trim().toLowerCase();
  return q === ''
    ? list
    : list.filter((h) => h.expr.toLowerCase().includes(q) || h.result.toLowerCase().includes(q));
}

/** One line per calculation, oldest first, for a note. */
export function historyText(list: HistoryEntry[]): string {
  return [...list]
    .reverse()
    .map((h) => `${h.expr} = ${h.result}`)
    .join('\n');
}
