import type { ConnectorContext, MediaItem, NowPlayingSource } from '@/core/connectors/types';

let memo: { ctx: ConnectorContext; version: number; promise: Promise<MediaItem[]> } | undefined;

/**
 * "Zuletzt gespielt", asked once per player state however many parts of the page show it (the start view's row and the head's
 * cover while nothing plays). Kept only as the pending or last answer of this state; a failure is not kept.
 */
export function readRecent(
  source: NowPlayingSource,
  ctx: ConnectorContext,
  version: number,
): Promise<MediaItem[]> {
  if (!source.recent) return Promise.resolve([]);
  if (memo && memo.ctx === ctx && memo.version === version) return memo.promise;
  const promise = source.recent(ctx);
  const mine = { ctx, version, promise };
  memo = mine;
  promise.catch(() => {
    if (memo === mine) memo = undefined;
  });
  return promise;
}

/** For tests. */
export function forgetRecent(): void {
  memo = undefined;
}
