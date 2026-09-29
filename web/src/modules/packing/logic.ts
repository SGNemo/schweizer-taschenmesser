import type { PackingItem } from './schema';

export function progress(items: readonly Pick<PackingItem, 'packed'>[]): {
  packed: number;
  total: number;
  complete: boolean;
} {
  const packed = items.filter((i) => i.packed).length;
  return { packed, total: items.length, complete: items.length > 0 && packed === items.length };
}

/** Open items first (in list order), packed ones after. */
export function sortItems<T extends PackingItem & { createdAt: number }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => Number(a.packed) - Number(b.packed) || a.order - b.order || a.createdAt - b.createdAt,
  );
}

/** Next `order` value so new items go to the end. */
export const nextOrder = (items: readonly Pick<PackingItem, 'order'>[]): number =>
  items.reduce((max, i) => Math.max(max, i.order), -1) + 1;

/** "Kopie von X", "Kopie von X (2)" … avoiding names that already exist. */
export function copyName(name: string, existing: readonly string[]): string {
  const base = `Kopie von ${name}`;
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n++) if (!existing.includes(`${base} (${n})`)) return `${base} (${n})`;
}
