/**
 * The search in the own map: every word of the query starts a word of a stored name. Answers come
 * from the device-local names table (`maps_name`), nothing leaves the device. One hit per kind and
 * name, nearest to the shown position first among equals.
 */
import type { Repo } from '@/core/db/repo';
import { distanceMeters } from '../logic';
import type { NameRow } from '../schema';
import { normalize, tokensOf, type NameKind } from './names';

export interface OwnHit {
  name: string;
  kind: NameKind;
  lat: number;
  lon: number;
  regionId: string;
}

const KIND_RANK: Record<NameKind, number> = {
  place: 0,
  street: 1,
  water: 2,
  poi: 3,
  area: 4,
  other: 5,
};

type Score = [number, number, number];
const less = (a: Score, b: Score): boolean =>
  a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];

/** Hits of the own map for a query: the name starts with the query first, then places before streets, nearest first. */
export async function searchOwn(
  query: string,
  names: Repo<NameRow>,
  near?: { lat: number; lon: number },
  limit = 8,
): Promise<OwnHit[]> {
  const words = tokensOf(query);
  if (words.length === 0) return [];
  const rows = await names.table.where('tokens').startsWith(words[0]!).distinct().toArray();
  const q = normalize(query);
  const best = new Map<string, { row: NameRow; score: Score }>();
  for (const r of rows) {
    if (r.deletedAt !== null) continue;
    if (!words.every((w) => r.tokens.some((t) => t.startsWith(w)))) continue;
    const norm = normalize(r.name);
    const score: Score = [
      norm.startsWith(q) ? 0 : 1,
      KIND_RANK[r.kind],
      near ? distanceMeters(near, r) : 0,
    ];
    const key = `${r.kind}|${norm}`;
    const prev = best.get(key);
    if (!prev || less(score, prev.score)) best.set(key, { row: r, score });
  }
  return [...best.values()]
    .sort((a, b) =>
      less(a.score, b.score)
        ? -1
        : less(b.score, a.score)
          ? 1
          : a.row.name.localeCompare(b.row.name),
    )
    .slice(0, limit)
    .map(({ row }) => ({
      name: row.name,
      kind: row.kind,
      lat: row.lat,
      lon: row.lon,
      regionId: row.regionId,
    }));
}
