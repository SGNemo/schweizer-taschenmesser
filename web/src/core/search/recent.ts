/**
 * Recent searches and opened results of the command palette. Device-local (localStorage), never
 * synced, never sent anywhere; the setting "Verlauf in der Suche" switches it off and "Verlauf
 * löschen" empties it.
 */
export interface RecentEntry {
  kind: 'command' | 'hit' | 'query';
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
    return Array.isArray(raw)
      ? raw
          .filter(
            (e): e is RecentEntry =>
              typeof e === 'object' &&
              e !== null &&
              typeof (e as RecentEntry).key === 'string' &&
              typeof (e as RecentEntry).label === 'string' &&
              ['command', 'hit', 'query'].includes((e as RecentEntry).kind),
          )
          .slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
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
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
