import { AGE_COUNT, AGE_LIMITS_DAYS, type DiskNode } from '@/core/platform/disk';
import { share } from './tree';

const DAY = 86_400;

/** Age in whole days of a change at `modifiedSec`, seen at `nowMs`; unknown or future = 0. */
export function ageDays(modifiedSec: number, nowMs: number): number {
  const now = Math.floor(nowMs / 1000);
  if (!(modifiedSec > 0) || modifiedSec >= now) return 0;
  return Math.floor((now - modifiedSec) / DAY);
}

/**
 * When an entry was last used: the newer of change and access where the scan trusts access times
 * (`ScanSummary.accessTracked`), else the change alone. Same rule as `tree::last_use` in Rust.
 */
export const lastUse = (n: Pick<DiskNode, 'modified' | 'accessed'>, byUse: boolean): number =>
  byUse ? Math.max(n.modified, n.accessed) : n.modified;

/** Bucket of an age in days; same rule as `kinds::age_bucket` in Rust. */
export function ageIndex(days: number): number {
  const i = AGE_LIMITS_DAYS.findIndex((limit) => days < limit);
  return i === -1 ? AGE_LIMITS_DAYS.length : i;
}

/** CSS custom properties (`Palette.module.css`) holding the colour of each age bucket. */
export const AGE_VAR: readonly string[] = Array.from({ length: AGE_COUNT }, (_, i) => `--age-${i}`);

/** First bucket that counts as "old" (one year and more) in summaries. */
export const OLD_FROM = 3;

/** Age breakdown of a node, oldest first, zero buckets left out. */
export function ageShares(node: Pick<DiskNode, 'ageBytes'>): {
  index: number;
  bytes: number;
  fraction: number;
}[] {
  const total = node.ageBytes.reduce((s, b) => s + b, 0);
  return node.ageBytes
    .map((bytes, index) => ({ index, bytes, fraction: share(bytes, total) }))
    .filter((a) => a.bytes > 0)
    .reverse();
}

/** Bytes not changed for at least a year (`OLD_FROM` and older). */
export const oldBytes = (node: Pick<DiskNode, 'ageBytes'>): number =>
  node.ageBytes.slice(OLD_FROM).reduce((s, b) => s + b, 0);

export const sumBytes = (nodes: readonly Pick<DiskNode, 'bytes'>[]): number =>
  nodes.reduce((s, n) => s + n.bytes, 0);

/**
 * Bytes of query results without counting anything twice: an entry inside a listed folder is
 * already part of that folder's size. Uses `relPath` (the parent folder below the scan root).
 */
export function disjointBytes(
  nodes: readonly Pick<DiskNode, 'bytes' | 'name' | 'kind' | 'relPath'>[],
): number {
  const key = (n: Pick<DiskNode, 'name' | 'relPath'>) =>
    (n.relPath ? `${n.relPath}/${n.name}` : n.name).replace(/\\/g, '/');
  const folders = nodes.filter((n) => n.kind === 'dir').map((n) => `${key(n)}/`);
  return nodes
    .filter((n) => !folders.some((f) => `${key(n)}/`.startsWith(f) && `${key(n)}/` !== f))
    .reduce((s, n) => s + n.bytes, 0);
}
