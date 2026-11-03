import { t } from '@/strings';
import { SECTIONS, type Item, type List, type Section } from './schema';

/** "2x Milch" / "500 g Mehl" / "Brot" → quantity + name. Only a leading number (with optional unit or "x") counts. */
export function parseEntry(text: string): { name: string; quantity?: string } {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const m = trimmed.match(
    /^(\d+(?:[.,]\d+)?)\s*(x|×|g|kg|ml|l|stk\.?|st\.?|pkg\.?|packung(?:en)?|flasche(?:n)?|dose(?:n)?)?\s+(.+)$/i,
  );
  if (!m) return { name: trimmed };
  const unit = m[2]?.toLowerCase();
  const quantity = unit && unit !== 'x' && unit !== '×' ? `${m[1]} ${m[2]}` : m[1]!;
  return { name: m[3]!, quantity };
}

/** Tab order: by `order`, then creation (the shopping list has order 0 and comes first). */
export function sortLists<T extends List & { createdAt: number }>(lists: readonly T[]): T[] {
  return [...lists].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/** Open items first (in list order), done ones after. */
export function sortItems<T extends Item & { createdAt: number }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => Number(a.done) - Number(b.done) || a.order - b.order || a.createdAt - b.createdAt,
  );
}

/** Name already on the open items (ignoring case)? Used to avoid duplicates on a shopping list. */
export function isDuplicate(items: readonly Pick<Item, 'name' | 'done'>[], name: string): boolean {
  const key = name.trim().toLowerCase();
  return items.some((i) => !i.done && i.name.trim().toLowerCase() === key);
}

export function progress(items: readonly Pick<Item, 'done'>[]): {
  done: number;
  total: number;
  complete: boolean;
} {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, complete: items.length > 0 && done === items.length };
}

/** Next `order` value so new entries go to the end. */
export const nextOrder = (items: readonly Pick<Item, 'order'>[]): number =>
  items.reduce((max, i) => Math.max(max, i.order), -1) + 1;

/** "Copy of X", "Copy of X (2)" … (current language) avoiding names that already exist. */
export function copyName(name: string, existing: readonly string[]): string {
  const base = t.lists.copyOf(name);
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) if (!existing.includes(`${base} (${n})`)) return `${base} (${n})`;
}

/** Ready-made packing lists the start-data wizard offers (texts live in `strings.ts`). */
export const PACKING_TEMPLATES = [
  'weekend',
  'camping',
  'beach',
  'ski',
  'familyTrip',
  'school',
  'business',
] as const;
export type PackingTemplate = (typeof PACKING_TEMPLATES)[number];

export interface ItemGroup<T> {
  /** Section id, the category text or '' for entries without one. */
  id: string;
  items: T[];
}

/**
 * Groups already sorted entries: shopping by store section (walk order, "no section" last), packing by
 * category (first appearance). Returns one group with id '' when nothing is assigned, so the page can
 * stay flat until the reader uses groups at all.
 */
export function groupItems<T extends Pick<Item, 'section' | 'category'>>(
  items: readonly T[],
  by: 'section' | 'category',
): ItemGroup<T>[] {
  if (!items.some((i) => (by === 'section' ? i.section : i.category)))
    return [{ id: '', items: [...items] }];
  const keyOf = (i: T) => (by === 'section' ? (i.section ?? '') : (i.category ?? ''));
  const ids =
    by === 'section'
      ? [...SECTIONS, '']
      : [...new Set(items.map(keyOf))].sort((a, b) => Number(a === '') - Number(b === ''));
  return ids
    .map((id) => ({ id, items: items.filter((i) => keyOf(i) === id) }))
    .filter((g) => g.items.length > 0);
}

/** Sum of the entered prices: what is still to buy and what is in the basket (ticked). */
export function totals(items: readonly Pick<Item, 'priceCents' | 'done'>[]): {
  openCents: number;
  doneCents: number;
  priced: number;
} {
  let openCents = 0;
  let doneCents = 0;
  let priced = 0;
  for (const i of items) {
    if (i.priceCents === undefined) continue;
    priced += 1;
    if (i.done) doneCents += i.priceCents;
    else openCents += i.priceCents;
  }
  return { openCents, doneCents, priced };
}

/** Names bought before (any row of the list, also removed ones) most often first, minus what is open now. */
export function suggestNames(
  history: readonly Pick<Item, 'name'>[],
  openNames: readonly string[],
  limit = 6,
): string[] {
  const open = new Set(openNames.map((n) => n.trim().toLowerCase()));
  const count = new Map<string, { name: string; n: number }>();
  for (const h of history) {
    const key = h.name.trim().toLowerCase();
    if (!key || open.has(key)) continue;
    const c = count.get(key);
    if (c) c.n += 1;
    else count.set(key, { name: h.name.trim(), n: 1 });
  }
  return [...count.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((c) => c.name);
}

/** The section (and price) the same name had last time, so a re-added entry lands in its group again. */
export function recall(
  history: readonly (Pick<Item, 'name' | 'section' | 'priceCents'> & { updatedAt: number })[],
  name: string,
): { section?: Section; priceCents?: number } {
  const key = name.trim().toLowerCase();
  const last = history
    .filter((h) => h.name.trim().toLowerCase() === key && (h.section || h.priceCents !== undefined))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return last
    ? {
        ...(last.section ? { section: last.section } : {}),
        ...(last.priceCents !== undefined ? { priceCents: last.priceCents } : {}),
      }
    : {};
}

/** Plain-text copy of a list for a message: "[ ] 2 Milch", ticked entries with "[x]". */
export function listAsText(
  title: string,
  items: readonly Pick<Item, 'name' | 'quantity' | 'done'>[],
): string {
  const lines = items.map(
    (i) => `${i.done ? '[x]' : '[ ]'} ${[i.quantity, i.name].filter(Boolean).join(' ')}`,
  );
  return [title, ...lines].join('\n');
}
