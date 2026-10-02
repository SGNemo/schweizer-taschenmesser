import type { Item, List } from './schema';

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

/** "Kopie von X", "Kopie von X (2)" … avoiding names that already exist. */
export function copyName(name: string, existing: readonly string[]): string {
  const base = `Kopie von ${name}`;
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) if (!existing.includes(`${base} (${n})`)) return `${base} (${n})`;
}

/** Ready-made packing lists the start-data wizard offers (texts live in `strings.ts`). */
export const PACKING_TEMPLATES = ['weekend', 'camping', 'beach', 'ski'] as const;
export type PackingTemplate = (typeof PACKING_TEMPLATES)[number];
