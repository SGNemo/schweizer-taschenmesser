import type { Stored } from '@/core/db/types';
import {
  CATEGORIES,
  NO_CATEGORY,
  type BuiltinCategory,
  type CategoryIcon,
  type DocCategory,
  type DocumentCategory,
} from './schema';

/** Colour and icon of a built-in category before the user changes them. */
const BUILTIN_LOOK: Record<BuiltinCategory, { tone: number; icon: CategoryIcon }> = {
  identity: { tone: 0, icon: 'users' },
  insurance: { tone: 1, icon: 'umbrella' },
  contract: { tone: 2, icon: 'file' },
  warranty: { tone: 3, icon: 'package' },
  tax: { tone: 4, icon: 'calculator' },
  health: { tone: 5, icon: 'heart' },
  other: { tone: 0, icon: 'files' },
};

export const isBuiltin = (id: string): id is BuiltinCategory =>
  (CATEGORIES as readonly string[]).includes(id);

/** A category as the page shows it: built-in defaults merged with what the user stored. */
export interface ResolvedCategory {
  id: DocCategory;
  /** The user's name; undefined = the built-in name (translated at render time, see `categoryLabel`). */
  name?: string;
  tone: number;
  icon: CategoryIcon;
  order: number;
  builtin: boolean;
  /** "Ohne Kategorie": always there, last, never edited or deleted. */
  fixed: boolean;
}

/**
 * The live categories in their order, "Ohne Kategorie" always last. Built-in ones without a record keep their
 * place (order = position in `CATEGORIES`); removed ones (`removed`; a custom one also as a tombstone) are left
 * out. A record for
 * "Ohne Kategorie" is ignored: it cannot be renamed, moved or removed, so no device can make it disappear.
 */
export function resolveCategories(
  records: readonly Pick<Stored<DocumentCategory>, 'id' | 'deletedAt' | keyof DocumentCategory>[],
): ResolvedCategory[] {
  const byId = new Map(records.map((r) => [r.id, r]));
  const out: ResolvedCategory[] = [];
  CATEGORIES.forEach((id, index) => {
    if (id === NO_CATEGORY) return;
    // A tombstone on a built-in id means "no record" (e.g. "Rückgängig" after its first change): the defaults hold.
    const found = byId.get(id);
    const r = found && found.deletedAt === null ? found : undefined;
    if (r?.removed) return;
    const look = BUILTIN_LOOK[id];
    out.push({
      id,
      name: r?.name?.trim() || undefined,
      tone: r?.tone ?? look.tone,
      icon: r?.icon ?? look.icon,
      order: r?.order ?? index,
      builtin: true,
      fixed: false,
    });
  });
  for (const r of records) {
    if (isBuiltin(r.id) || r.removed || r.deletedAt !== null || !r.name?.trim()) continue;
    out.push({
      id: r.id,
      name: r.name.trim(),
      tone: r.tone,
      icon: r.icon,
      order: r.order,
      builtin: false,
      fixed: false,
    });
  }
  // Same order on every device: by `order`, ties by id (never by the name, which is translated).
  out.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  out.push({ id: NO_CATEGORY, ...BUILTIN_LOOK.other, order: Infinity, builtin: true, fixed: true });
  return out;
}

/**
 * The category a document is shown in: its own while that is live, otherwise "Ohne Kategorie". A document is
 * never hidden because its category is gone (removed on another device, a category from an import or the
 * assistant that no longer exists): it waits under "Ohne Kategorie".
 */
export function categoryOfDoc(doc: { category?: string }, live: ReadonlySet<string>): DocCategory {
  const id = doc.category ?? NO_CATEGORY;
  return live.has(id) ? id : NO_CATEGORY;
}

/** Name of a category: the user's name, else the built-in one from `names` (the translated table). */
export function categoryLabel(
  c: Pick<ResolvedCategory, 'id' | 'name'> | undefined,
  names: Record<string, string>,
): string {
  if (!c) return names[NO_CATEGORY] ?? NO_CATEGORY;
  return c.name ?? names[c.id] ?? c.id;
}

/** Number of documents per shown category (documents of a gone category count under "Ohne Kategorie"). */
export function countByResolved(
  docs: readonly { category?: string }[],
  cats: readonly ResolvedCategory[],
): Map<DocCategory, number> {
  const live = new Set(cats.map((c) => c.id));
  const out = new Map<DocCategory, number>();
  for (const d of docs) {
    const id = categoryOfDoc(d, live);
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

/** `order` for a new category: after the last one. */
export const nextCategoryOrder = (cats: readonly ResolvedCategory[]): number =>
  cats.reduce((max, c) => (c.fixed ? max : Math.max(max, c.order)), -1) + 1;

/**
 * The `order` writes that move a category one step up or down: the two neighbours swap places. Every category
 * between gets an explicit order too when the old values tie, so the move holds on every device.
 */
export function moveCategory(
  cats: readonly ResolvedCategory[],
  id: string,
  dir: -1 | 1,
): { id: string; order: number }[] {
  const list = cats.filter((c) => !c.fixed);
  const i = list.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return [];
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  // Renumber 0..n-1 and write only what changed: stable and free of ties afterwards.
  return next.flatMap((c, k) => (c.order === k ? [] : [{ id: c.id, order: k }]));
}

/** Documents (ids) whose shown category is `id`: what a removal has to move. */
export function docsInCategory(
  docs: readonly { id: string; category?: string }[],
  cats: readonly ResolvedCategory[],
  id: string,
): string[] {
  const live = new Set(cats.map((c) => c.id));
  return docs.filter((d) => categoryOfDoc(d, live) === id).map((d) => d.id);
}
