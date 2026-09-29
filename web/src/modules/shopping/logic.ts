import type { ShoppingItem } from './schema';

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

/** Open items first (oldest first, so the list keeps its order), bought items last. */
export function sortItems<T extends ShoppingItem & { createdAt: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
}

/** Name already on the open list (ignoring case)? Used to avoid duplicates. */
export function isDuplicate(items: readonly ShoppingItem[], name: string): boolean {
  const key = name.trim().toLowerCase();
  return items.some((i) => !i.done && i.name.trim().toLowerCase() === key);
}
