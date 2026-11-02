import { markdownToPlain } from './editor/markdown';
import type { Note } from './schema';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const firstLine = (body: string): string =>
  markdownToPlain(body)
    .split('\n')
    .find((l) => l.trim())
    ?.trim() ?? '';

/** Title, or the first line of the body for untitled notes. */
export function displayTitle(n: Pick<Note, 'title' | 'body'>): string {
  return n.title.trim() || firstLine(n.body).slice(0, 80);
}

/** Body without the line that is used as title; shortened for list cards. */
export function excerpt(n: Pick<Note, 'title' | 'body'>, max = 140): string {
  const body = markdownToPlain(n.body).trim();
  const rest = n.title.trim() ? body : body.split('\n').slice(1).join('\n').trim();
  const flat = rest.replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** The fixed scratch pad ("Zettel"): one note with this id, always on top, never deleted. */
export const SCRATCH_ID = 'scratch';
export const isScratch = (n: { id: string }): boolean => n.id === SCRATCH_ID;

/** Scratch pad first, then pinned, then most recently changed. */
export function sortNotes<T extends Note & { id: string; updatedAt: number }>(
  notes: readonly T[],
): T[] {
  return [...notes].sort(
    (a, b) =>
      Number(isScratch(b)) - Number(isScratch(a)) ||
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt - a.updatedAt,
  );
}

export function searchNotes<T extends Note>(notes: readonly T[], query: string): T[] {
  const q = fold(query.trim());
  return q
    ? notes.filter((n) => fold(`${n.title}\n${markdownToPlain(n.body)}`).includes(q))
    : [...notes];
}

/* ---- notebooks, sorting, manual order ---- */

export type SortMode = 'recent' | 'title' | 'manual';
export const SORT_MODES: readonly SortMode[] = ['recent', 'title', 'manual'];

/** `all` = every page, `none` = pages without a notebook ("Allgemein"), otherwise a notebook id. */
export type NotebookFilter = 'all' | 'none' | (string & {});

/** Icons a notebook can use (names from `ui/icons`). */
export const NOTEBOOK_ICONS = [
  'note',
  'home',
  'calendar',
  'checklist',
  'bookmark',
  'gift',
  'luggage',
  'target',
  'puzzle',
  'heart',
  'star',
  'globe',
] as const;

type Page = Note & { id: string; updatedAt: number };

export function filterByNotebook<T extends Page>(notes: readonly T[], filter: NotebookFilter): T[] {
  if (filter === 'all') return [...notes];
  return notes.filter((n) =>
    isScratch(n) ? true : filter === 'none' ? n.notebookId === null : n.notebookId === filter,
  );
}

/**
 * Scratch pad first, then pinned, then by the chosen order: most recently changed, title (language
 * aware, via `compare`) or the manual `order`.
 */
export function sortPages<T extends Page>(
  notes: readonly T[],
  mode: SortMode,
  compare: (a: string, b: string) => number = (a, b) => a.localeCompare(b),
): T[] {
  return [...notes].sort((a, b) => {
    const top = Number(isScratch(b)) - Number(isScratch(a)) || Number(b.pinned) - Number(a.pinned);
    if (top) return top;
    if (mode === 'title')
      return compare(displayTitle(a), displayTitle(b)) || b.updatedAt - a.updatedAt;
    if (mode === 'manual') return a.order - b.order || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Writes needed to bring the manual order in line with `ids` (the new visual order of the shown
 * pages). Orders are spread out in steps of 10 over the whole list; only changed pages are returned.
 */
export function orderPatches(
  ids: readonly string[],
  notes: readonly { id: string; order: number }[],
): { id: string; order: number }[] {
  const current = new Map(notes.map((n) => [n.id, n.order]));
  const out: { id: string; order: number }[] = [];
  ids.forEach((id, i) => {
    const order = (i + 1) * 10;
    if (current.get(id) !== order) out.push({ id, order });
  });
  return out;
}

/** Number of pages per notebook id (`null` key = "Allgemein"); the scratch pad is not counted. */
export function countByNotebook(
  notes: readonly Note[] & readonly { id: string }[],
): Map<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const n of notes) {
    if (isScratch(n)) continue;
    counts.set(n.notebookId, (counts.get(n.notebookId) ?? 0) + 1);
  }
  return counts;
}

/** Next free position for a new notebook. */
export const nextNotebookOrder = (books: readonly { order: number }[]): number =>
  books.reduce((m, b) => Math.max(m, b.order), 0) + 10;
