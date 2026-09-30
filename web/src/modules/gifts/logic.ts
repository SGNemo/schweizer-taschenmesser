import type { Idea, Status } from './schema';

/** Only http(s) links are kept (a "javascript:" link in a shared backup must never be clickable). */
export function safeUrl(input: string): string | undefined {
  const v = input.trim();
  if (!v) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export type StatusFilter = 'all' | Status;

export const applyFilter = <T extends Idea>(ideas: readonly T[], f: StatusFilter): T[] =>
  f === 'all' ? [...ideas] : ideas.filter((i) => i.status === f);

const RANK: Record<Status, number> = { idea: 0, bought: 1, given: 2 };

/** People A–Z; inside a person open ideas first, then by occasion date, then by title. */
export function groupByPerson<T extends Idea>(
  ideas: readonly T[],
): { person: string; ideas: T[] }[] {
  const map = new Map<string, T[]>();
  for (const i of ideas) {
    const key = i.forWhom.trim();
    map.set(key, [...(map.get(key) ?? []), i]);
  }
  return [...map]
    .sort((a, b) => a[0].localeCompare(b[0], 'de'))
    .map(([person, list]) => ({
      person,
      ideas: list.sort(
        (a, b) =>
          RANK[a.status] - RANK[b.status] ||
          (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
          a.title.localeCompare(b.title, 'de'),
      ),
    }));
}

export interface Totals {
  open: number;
  bought: number;
  given: number;
  /** Sum of the prices of bought and given gifts, in cents. */
  spentCents: number;
}

export function totals(ideas: readonly Idea[]): Totals {
  const t: Totals = { open: 0, bought: 0, given: 0, spentCents: 0 };
  for (const i of ideas) {
    if (i.status === 'idea') t.open++;
    else {
      if (i.status === 'bought') t.bought++;
      else t.given++;
      t.spentCents += i.priceCents ?? 0;
    }
  }
  return t;
}
