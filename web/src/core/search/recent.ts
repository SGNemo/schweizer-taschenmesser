import { clearFrequent } from '@/core/settings/frequent';
import { clearRecentTools } from '@/core/tools/recent';

/**
 * Recently used commands and opened results of the command palette. Device-local (localStorage),
 * never synced, never sent anywhere; the setting "Verlauf in der Suche" switches it off (and
 * empties it) and "Verlauf löschen" empties it. Typed questions are never stored: older versions
 * kept them (kind `query`), those entries are dropped on first read.
 */
export interface RecentEntry {
  kind: 'command' | 'hit';
  /** Stable id: the command id, the hit's key or `q-<query>`. */
  key: string;
  label: string;
  to?: string;
  subtitle?: string;
}

const KEY = 'tm-recent-search';
export const MAX_RECENT = 6;

export function readRecent(): RecentEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const kept = raw.filter(
      (e): e is RecentEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as RecentEntry).key === 'string' &&
        typeof (e as RecentEntry).label === 'string' &&
        ['command', 'hit'].includes((e as RecentEntry).kind),
    );
    // Legacy `query` entries (typed text, possibly secrets) are removed from storage, not just hidden.
    if (kept.length !== raw.length) localStorage.setItem(KEY, JSON.stringify(kept));
    return kept.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Removes typed questions kept by older versions; used by "KI abschalten". */
export function purgeTypedQueries(): void {
  readRecent();
}

/** Newest first, no duplicates, at most `MAX_RECENT`. */
export function addRecent(entry: RecentEntry): void {
  try {
    const rest = readRecent().filter((e) => e.key !== entry.key);
    localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, MAX_RECENT)));
  } catch {
    // Storage may be blocked; the history is a convenience only.
  }
}

export function clearRecent(): void {
  clearFrequent();
  clearRecentTools();
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
