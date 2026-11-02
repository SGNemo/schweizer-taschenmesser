import { getBlob, putBlob } from '@/core/blobs';

/** One earlier state of a page, kept on this device only (`_blobs`, never synced, never in a backup). */
export interface Version {
  at: number;
  title: string;
  body: string;
}

export const MAX_VERSIONS = 20;
/** While writing, a new state is kept at most every two minutes. */
export const MIN_GAP_MS = 120_000;

/**
 * Adds a state to the list (newest first). Identical to the newest state: nothing changes. Closer than
 * `MIN_GAP_MS` to the newest state: skipped, unless `force` (restoring, closing). Keeps the latest
 * `MAX_VERSIONS`. Pure.
 */
export function addVersion(
  list: readonly Version[],
  next: Version,
  opts: { force?: boolean; max?: number; gapMs?: number } = {},
): Version[] {
  const { force = false, max = MAX_VERSIONS, gapMs = MIN_GAP_MS } = opts;
  const newest = list[0];
  if (newest && newest.title === next.title && newest.body === next.body) return [...list];
  if (newest && !force && next.at - newest.at < gapMs) return [...list];
  return [next, ...list].slice(0, max);
}

const key = (pageId: string) => `notes:ver:${pageId}`;

export async function loadVersions(pageId: string): Promise<Version[]> {
  try {
    const blob = await getBlob(key(pageId));
    if (!blob) return [];
    const data: unknown = JSON.parse(await blob.text());
    return Array.isArray(data)
      ? data.filter(
          (v): v is Version =>
            !!v &&
            typeof v.at === 'number' &&
            typeof v.title === 'string' &&
            typeof v.body === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

/** Never throws: a page must save even when the history cannot be written. */
export async function recordVersion(
  pageId: string,
  next: Version,
  opts: { force?: boolean } = {},
): Promise<void> {
  try {
    const list = await loadVersions(pageId);
    const updated = addVersion(list, next, opts);
    if (updated.length === list.length && updated[0] === list[0]) return;
    await putBlob(key(pageId), new Blob([JSON.stringify(updated)], { type: 'application/json' }));
  } catch {
    /* history is a convenience */
  }
}
