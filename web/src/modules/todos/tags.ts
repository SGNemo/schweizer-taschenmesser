import type { Task } from './schema';

/** "#Einkauf " → "einkauf": one tag is a lower-case word without `#`, spaces or commas. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .replace(/[\s,;#]+/g, '-')
    .toLowerCase();
}

/** Splits "a, #b c" into distinct tags (order kept). */
export function parseTags(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,;\s]+/)) {
    const tag = normalizeTag(part);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out;
}

/** Every tag in use with its count of open tasks, most used first, then A–Z. */
export function tagCounts(tasks: readonly Pick<Task, 'tags' | 'done'>[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (t.done) continue;
    for (const tag of t.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
