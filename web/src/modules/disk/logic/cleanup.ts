import type { DiskNode } from '@/core/platform/disk';
import type { CleanupPlace } from '@/core/platform/optimize';

/**
 * Selection of one clean-up suggestion. A suggestion previews its biggest entries (`items`) and
 * knows the ids of all of them (`ids`); the entries without a preview row are "the rest" and are
 * ticked or unticked together.
 */
export type Selection = ReadonlySet<number>;

/** Caches and temp files start ticked; the user's own downloads start empty. */
export const initialSelection = (place: CleanupPlace): Selection =>
  new Set(place.preselected ? place.ids : []);

/** Ids of the suggested entries that have no preview row. */
export function restIds(place: CleanupPlace): number[] {
  const shown = new Set(place.items.map((n) => n.id));
  return place.ids.filter((id) => !shown.has(id));
}

export function toggleItem(selection: Selection, id: number): Selection {
  const next = new Set(selection);
  if (!next.delete(id)) next.add(id);
  return next;
}

/** Ticks or unticks all entries without a preview row. */
export function setRest(place: CleanupPlace, selection: Selection, on: boolean): Selection {
  const next = new Set(selection);
  for (const id of restIds(place)) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Ticks or unticks everything. */
export const setAll = (place: CleanupPlace, on: boolean): Selection => new Set(on ? place.ids : []);

export const restSelected = (place: CleanupPlace, selection: Selection): boolean => {
  const rest = restIds(place);
  return rest.length > 0 && rest.every((id) => selection.has(id));
};

/** Bytes of the entries without a preview row (the total minus what is shown). */
export const restBytes = (place: CleanupPlace): number =>
  Math.max(0, place.totalBytes - place.items.reduce((sum, n) => sum + n.bytes, 0));

/** Size of the ticked entries. The rest counts as a whole or not at all. */
export function selectedBytes(place: CleanupPlace, selection: Selection): number {
  const shown = place.items.reduce((sum, n) => (selection.has(n.id) ? sum + n.bytes : sum), 0);
  return shown + (restSelected(place, selection) ? restBytes(place) : 0);
}

/** The ticked ids in the order of the suggestion (what goes into the delete plan). */
export const selectedIds = (place: CleanupPlace, selection: Selection): number[] =>
  place.ids.filter((id) => selection.has(id));

/**
 * The suggestion after a delete run: only entries that still exist directly below the place's
 * root (`children`, as the scan tree reports them now) stay. Returns null when nothing is left.
 */
export function refreshPlace(place: CleanupPlace, children: DiskNode[]): CleanupPlace | null {
  const alive = new Map(children.map((n) => [n.id, n]));
  const ids = place.ids.filter((id) => alive.has(id));
  if (ids.length === 0) return null;
  const all = ids.map((id) => alive.get(id)!);
  return {
    ...place,
    ids,
    items: place.items.filter((n) => alive.has(n.id)).map((n) => alive.get(n.id)!),
    totalBytes: all.reduce((sum, n) => sum + n.bytes, 0),
    totalFiles: all.reduce((sum, n) => sum + n.files, 0),
  };
}

/** A selection after a refresh: ids that are gone drop out. */
export const pruneSelection = (place: CleanupPlace, selection: Selection): Selection => {
  const ids = new Set(place.ids);
  return new Set([...selection].filter((id) => ids.has(id)));
};

/** Everything the suggestions offer together (the figure of the summary line). */
export const totalBytes = (places: readonly CleanupPlace[]): number =>
  places.reduce((sum, p) => sum + p.totalBytes, 0);
