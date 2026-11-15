import { t } from '@/strings';
import { SECTIONS, type Item, type List, type ListKind, type Section } from './schema';

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

/** Store sections the head names: only assigned ones ("Ohne Bereich" is no section to walk to). */
export function namedSectionCount(groups: readonly ItemGroup<unknown>[]): number {
  return groups.filter((g) => g.id !== '').length;
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
  limit = 4,
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

/** Icons a list can carry (names of `@/ui` icons); the first three are the kinds' own. */
export const LIST_ICONS = [
  'cart',
  'luggage',
  'checklist',
  'home',
  'gift',
  'star',
  'heart',
  'package',
  'calendar',
  'car',
  'sun',
  'wrench',
] as const;
export type ListIcon = (typeof LIST_ICONS)[number];

const KIND_ICON: Record<ListKind, ListIcon> = {
  shopping: 'cart',
  packing: 'luggage',
  checklist: 'checklist',
};

/** The list's icon: its own when it is one of `LIST_ICONS`, else the kind's. */
export function iconOf(list: Pick<List, 'icon' | 'kind'>): ListIcon {
  return (LIST_ICONS as readonly string[]).includes(list.icon ?? '')
    ? (list.icon as ListIcon)
    : KIND_ICON[list.kind];
}

/** Lists in tab order, split into the ones in use and the archived ones. */
export function splitArchived<T extends List & { createdAt: number }>(
  lists: readonly T[],
): { active: T[]; archived: T[] } {
  const sorted = sortLists(lists);
  return { active: sorted.filter((l) => !l.archived), archived: sorted.filter((l) => l.archived) };
}

/**
 * New sort keys after moving one list a step up (-1) or down (+1) among the lists in use: every list gets its
 * position as `order` (old data has many 0s). Returns only the lists whose key changes; nothing at the edges.
 */
export function moveOrders<T extends List & { id: string; createdAt: number }>(
  lists: readonly T[],
  id: string,
  step: -1 | 1,
): { id: string; order: number }[] {
  const ordered = splitArchived(lists).active;
  const from = ordered.findIndex((l) => l.id === id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ordered.length) return [];
  const next = [...ordered];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next.flatMap((l, i) => (l.order === i ? [] : [{ id: l.id, order: i }]));
}

/** Where items for "the shopping list" go: the first shopping list in use, in the user's order. */
export function pickShoppingTarget<T extends List & { id: string; createdAt: number }>(
  lists: readonly T[],
): T | undefined {
  return splitArchived(lists).active.find((l) => l.kind === 'shopping');
}

/**
 * The list the widget shows: the chosen one while it is in use, else the first shopping list in use, else the
 * first list in use (an archived or deleted choice falls back quietly).
 */
export function pickWidgetList<T extends List & { id: string; createdAt: number }>(
  lists: readonly T[],
  chosenId: string,
): T | undefined {
  const { active } = splitArchived(lists);
  return active.find((l) => l.id === chosenId) ?? pickShoppingTarget(lists) ?? active[0];
}

/**
 * Shared text as list entries: one entry per non-empty line, without list marks ("- ", "• ", "1. ", "[ ]", "[x]")
 * a messenger or another list app puts in front. A ticked "[x]" line stays an entry (to buy again). At most 100.
 */
export function sharedEntries(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*•–·]|\d{1,3}[.)])\s+/, '')
        .replace(/^\[[ xX✓]?\]\s*/, '')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 100);
}
