/** Finds the stored entry a sentence like "lösche das Abo Spotify" talks about – locally, no model. */
import type { TaschenmesserDB } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { fold } from '../text';
import type { TargetCandidate } from './types';

const STOPWORDS = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'mein',
  'meine',
  'meinen',
  'meinem',
  'von',
  'vom',
  'zu',
  'zum',
  'zur',
  'im',
  'in',
  'am',
  'an',
  'auf',
  'fur',
  'als',
  'mit',
  'bei',
  'und',
  'oder',
  'noch',
  'bitte',
]);

const tokens = (s: string): string[] =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);

/** True when `a` and `b` differ by one inserted, missing or replaced letter. */
export function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.slice(i) === long.slice(i + 1);
}

function tokenScore(q: string, candidate: string): number {
  if (q === candidate) return 1;
  const shared = Math.min(q.length, candidate.length);
  if (shared >= 4 && (candidate.startsWith(q) || q.startsWith(candidate))) return 0.85;
  if (
    q.length >= 5 &&
    candidate.length >= 5 &&
    (withinOneEdit(q, candidate) || swapped(q, candidate))
  )
    return 0.8;
  return 0;
}

const swapped = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] !== b[i])
      return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return false;
};

/** 0..1: how well `query` names `title`. Every query word has to find a (near) match. */
export function matchScore(query: string, title: string, ignore: readonly string[] = []): number {
  const skip = new Set(ignore.flatMap(tokens));
  const q = tokens(query).filter((w) => !STOPWORDS.has(w) && !skip.has(w));
  if (q.length === 0) return 0;
  const t = tokens(title);
  let sum = 0;
  for (const word of q) {
    const best = Math.max(0, ...t.map((c) => tokenScore(word, c)));
    if (best === 0) return 0;
    sum += best;
  }
  return sum / q.length;
}

export interface TargetSearch {
  /** The one entry that is clearly meant. */
  match?: TargetCandidate;
  /** Several equally good entries (≤ 5) – the user picks. */
  candidates: TargetCandidate[];
}

export async function findTarget(
  database: TaschenmesserDB,
  moduleId: string,
  collection: string,
  titleField: string,
  query: string,
  ignore: readonly string[] = [],
): Promise<TargetSearch> {
  const rows = await database
    .table<Record<string, unknown> & { id: string; deletedAt: number | null }, string>(
      tableName(moduleId, collection),
    )
    .toArray();
  const scored = rows
    .filter((r) => r.deletedAt === null)
    .map((r) => ({
      id: r.id,
      title: String(r[titleField] ?? ''),
      score: matchScore(query, String(r[titleField] ?? ''), ignore),
    }))
    .filter((r) => r.score >= 0.6)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const [first, second] = scored;
  if (!first) return { candidates: [] };
  const candidates = scored.slice(0, 5).map(({ id, title }) => ({ id, title }));
  if (!second || first.score - second.score > 0.1) {
    return { match: { id: first.id, title: first.title }, candidates };
  }
  return { candidates: candidates.filter((_, i) => scored[i]!.score >= first.score - 0.1) };
}
