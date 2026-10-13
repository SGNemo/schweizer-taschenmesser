/**
 * "Häufig genutzt": which settings sections the person opens most, shown at the top of the
 * settings navigation. Device-local (localStorage), never synced, never sent anywhere; switched off
 * with "Verlauf in der Suche" (focus settings) and emptied by "Verlauf löschen". Same idea and the
 * same limits as the palette history in `core/search/recent.ts`.
 */
const KEY = 'tm-frequent-settings';
/** A section needs this many visits before it is listed, so a single look never creates a shortcut. */
export const MIN_VISITS = 2;
export const MAX_LISTED = 5;
const MAX_TRACKED = 40;

interface Visit {
  n: number;
  /** Order of the last visit (a counter, not a clock). */
  seq: number;
}
type Visits = Record<string, Visit>;

function read(): Visits {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(
        (e): e is [string, Visit] =>
          typeof e[1] === 'object' &&
          e[1] !== null &&
          typeof (e[1] as Visit).n === 'number' &&
          typeof (e[1] as Visit).seq === 'number',
      ),
    );
  } catch {
    return {};
  }
}

function write(visits: Visits): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(visits));
  } catch {
    // Storage may be blocked; this list is a convenience only.
  }
}

/** Counts one visit of a settings section (`/settings/<category>#<section>`). */
export function recordSectionVisit(sectionId: string): void {
  const visits = read();
  const seq = Math.max(0, ...Object.values(visits).map((v) => v.seq)) + 1;
  visits[sectionId] = { n: (visits[sectionId]?.n ?? 0) + 1, seq };
  const keep = Object.entries(visits)
    .sort((a, b) => b[1].seq - a[1].seq)
    .slice(0, MAX_TRACKED);
  write(Object.fromEntries(keep));
}

/** Section ids, most visited first (ties: most recent first); only those among `known`. */
export function frequentSections(known: readonly string[], limit = MAX_LISTED): string[] {
  const visits = read();
  return Object.entries(visits)
    .filter(([id, v]) => v.n >= MIN_VISITS && known.includes(id))
    .sort((a, b) => b[1].n - a[1].n || b[1].seq - a[1].seq)
    .slice(0, limit)
    .map(([id]) => id);
}

export function clearFrequent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
