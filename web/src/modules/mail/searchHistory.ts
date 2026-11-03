/**
 * Recent searches of the mail page: device-local (`localStorage`, never synced, never sent anywhere), the last
 * five distinct ones. Suggestions are built from these plus names already in the local cache.
 */
const KEY = 'tm-mail-searches';
const MAX = 5;

export function readSearches(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string): string[] {
  const q = query.trim();
  if (!q) return readSearches();
  const next = [q, ...readSearches().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX,
  );
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: no history */
  }
  return next;
}

/** Suggestions for the search field: recent searches first, then sender names, each once, at most eight. */
export function suggestionsFor(
  draft: string,
  recent: readonly string[],
  senders: readonly string[],
): string[] {
  const needle = draft.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...recent, ...senders.map((n) => `from:${/\s/.test(n) ? `"${n}"` : n}`)]) {
    const key = s.toLowerCase();
    if (seen.has(key) || key === needle) continue;
    if (needle && !key.includes(needle)) continue;
    seen.add(key);
    out.push(s);
    if (out.length === 8) break;
  }
  return out;
}
