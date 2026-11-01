import { readStored, writeStored } from '../shared';

export interface HistoryEntry {
  expr: string;
  /** Result as shown (locale format) */
  result: string;
}

const KEY = 'tm-calc-history-2';
const LEGACY_KEY = 'tm-calc-history';
export const MAX_HISTORY = 100;

function isEntry(e: unknown): e is HistoryEntry {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as HistoryEntry).expr === 'string' &&
    typeof (e as HistoryEntry).result === 'string'
  );
}

/** The newest 100 calculations; entries of the former format (numeric result) are carried over. */
export function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(readStored(KEY) ?? 'null');
    if (Array.isArray(parsed)) return parsed.filter(isEntry).slice(0, MAX_HISTORY);
    const legacy: unknown = JSON.parse(readStored(LEGACY_KEY) ?? '[]');
    return Array.isArray(legacy)
      ? legacy
          .filter(
            (e): e is { expr: string; result: number } =>
              typeof e?.expr === 'string' && Number.isFinite(e?.result),
          )
          .map((e) => ({ expr: e.expr, result: String(e.result).replace('.', ',') }))
          .slice(0, MAX_HISTORY)
      : [];
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
