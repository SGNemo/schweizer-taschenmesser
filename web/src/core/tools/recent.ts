/**
 * The tools opened last, for the "Zuletzt benutzt" row above the toolbox tiles. Device-local
 * (localStorage), never synced or sent; switched off with "Verlauf in der Suche" (focus settings)
 * and emptied by "Verlauf löschen" like the other histories. The tiles themselves keep their order:
 * the grid stays where the hand expects it.
 */
const KEY = 'tm-tools-recent';
export const MAX_RECENT_TOOLS = 3;

export function readRecentTools(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT_TOOLS)
      : [];
  } catch {
    return [];
  }
}

/** Newest first, no duplicates, at most `MAX_RECENT_TOOLS`. */
export function recordToolUse(id: string): void {
  try {
    const rest = readRecentTools().filter((x) => x !== id);
    localStorage.setItem(KEY, JSON.stringify([id, ...rest].slice(0, MAX_RECENT_TOOLS)));
  } catch {
    // Storage may be blocked; the row is a convenience only.
  }
}

export function clearRecentTools(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
