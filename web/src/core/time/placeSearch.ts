/**
 * Offline place search for the clock: the cities of `cities.ts` (German, English, aliases) and every IANA zone the
 * platform knows (`Intl.supportedValuesOf('timeZone')`), matched with a small typo tolerance. Pure, no network.
 */
import { CITIES } from './cities';
import { isKnownZone } from './zones';

export interface PlaceHit {
  zone: string;
  /** The name to show and to store as the first label ("München" in German, "Munich" in English). */
  name: string;
  /** Lower is better: 0 exact, 1 prefix, 2 word prefix, 3 substring, 4+ typo distance. */
  score: number;
}

/** Lower case, no accents, `ß` → `ss`, separators → one space ("São_Paulo" → "sao paulo"). */
export function normalizePlace(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[_\-./'’,()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires"; "UTC" stays. */
export function zoneCityName(zone: string): string {
  return (zone.split('/').pop() ?? zone).replace(/_/g, ' ');
}

let zoneCache: readonly string[] | undefined;
/** Every zone the platform knows, plus UTC and the zones of the city table. */
export function allZones(): readonly string[] {
  if (!zoneCache) {
    let list: string[] = [];
    try {
      list = Intl.supportedValuesOf('timeZone');
    } catch {
      // Old engine: fall back to the zones of the city table below.
    }
    // The table's zones too: some engines list only the old names ("Asia/Calcutta" for "Asia/Kolkata").
    zoneCache = [...new Set(['UTC', ...list, ...CITIES.map((c) => c[0])])].filter(isKnownZone);
  }
  return zoneCache;
}

/** Optimal string alignment distance (Levenshtein plus swapped neighbours), cut off above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        rows[0]![j] = j;
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, rows[i - 2]![j - 2]! + 1);
      rows[i]![j] = v;
      best = Math.min(best, v);
    }
    if (i > 0 && best > max) return max + 1;
  }
  return rows[a.length]![b.length]!;
}

/** Typos allowed for a query of this length: none below 4 letters, one up to 6, two from 7. */
const tolerance = (len: number): number => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

function scoreName(q: string, name: string): number | undefined {
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(' ').some((w) => w.startsWith(q))) return 2;
  if (q.length >= 3 && name.includes(q)) return 3;
  const tol = tolerance(q.length);
  if (tol === 0) return undefined;
  // The whole name, or its beginning as long as the query ("Muenchn" → "muenchen").
  const d = Math.min(editDistance(q, name, tol), editDistance(q, name.slice(0, q.length), tol));
  return d <= tol ? 4 + d : undefined;
}

interface Candidate {
  zone: string;
  name: string;
  keys: string[];
}

const candidateCache = new Map<string, Candidate[]>();
function candidates(lang: string): Candidate[] {
  let list = candidateCache.get(lang);
  if (list) return list;
  list = [];
  for (const [zone, de, en, ...aliases] of CITIES) {
    if (!isKnownZone(zone)) continue;
    list.push({
      zone,
      name: lang === 'de' ? de || en : en,
      keys: [de, en, ...aliases].filter(Boolean).map(normalizePlace),
    });
  }
  for (const zone of allZones()) {
    list.push({
      zone,
      name: zoneCityName(zone),
      keys: [normalizePlace(zoneCityName(zone)), normalizePlace(zone)],
    });
  }
  candidateCache.set(lang, list);
  return list;
}

/**
 * Places for the typed text, best first: cities before bare zones at the same score, one hit per zone and name.
 * `lang` picks the display name of a city (German or English).
 */
export function searchPlaces(query: string, lang: string, limit = 8): PlaceHit[] {
  const q = normalizePlace(query);
  if (!q) return [];
  const hits: (PlaceHit & { order: number })[] = [];
  const seen = new Set<string>();
  candidates(lang).forEach((c, order) => {
    let best: number | undefined;
    for (const key of c.keys) {
      const s = scoreName(q, key);
      if (s !== undefined && (best === undefined || s < best)) best = s;
    }
    if (best === undefined) return;
    const id = `${c.zone}|${normalizePlace(c.name)}`;
    if (seen.has(id)) return;
    seen.add(id);
    hits.push({ zone: c.zone, name: c.name, score: best, order });
  });
  hits.sort((a, b) => a.score - b.score || a.order - b.order);
  return hits.slice(0, limit).map(({ zone, name, score }) => ({ zone, name, score }));
}

/** The one place a typed name clearly means ("Tokio", "tokyo", "Tokoi"), else `undefined`. Needs 3 letters. */
export function resolvePlace(query: string, lang: string): PlaceHit | undefined {
  if (normalizePlace(query).length < 3) return undefined;
  const [first] = searchPlaces(query, lang, 1);
  // A substring hit ("ber" in "Weißenberg") is too loose to act on without a choice.
  return first && first.score !== 3 ? first : undefined;
}

/** The device's zone (the reference for every offset), UTC when the platform cannot tell. */
export function localZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isKnownZone(zone) ? zone : 'UTC';
}
