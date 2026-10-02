import type { Note } from './schema';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Title, or the first line of the body for untitled notes. */
export function displayTitle(n: Pick<Note, 'title' | 'body'>): string {
  return n.title.trim() || n.body.trim().split('\n')[0]!.slice(0, 80);
}

/** Body without the line that is used as title; shortened for list cards. */
export function excerpt(n: Pick<Note, 'title' | 'body'>, max = 140): string {
  const body = n.body.trim();
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
  return q ? notes.filter((n) => fold(`${n.title}\n${n.body}`).includes(q)) : [...notes];
}
