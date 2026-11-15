import type { ConnectorContext, NowPlayingSource, Playlist } from '@/core/connectors/types';

/**
 * The playlists tab's reads, kept only while the page is open (the connection context lives as long as the page): every
 * playlist (up to 1000, one request per 50) and the account id that tells own from followed. Switching tabs reads nothing
 * again; an edit (new playlist, new name) calls `changedPlaylists` so the next look reads afresh. A failure is not kept.
 */
let lists: { ctx: ConnectorContext; generation: number; promise: Promise<Playlist[]> } | undefined;
let account: { ctx: ConnectorContext; promise: Promise<string | undefined> } | undefined;
let generation = 0;

export function readAllPlaylists(
  source: NowPlayingSource,
  ctx: ConnectorContext,
): Promise<Playlist[]> {
  if (!source.playlists) return Promise.resolve([]);
  if (lists && lists.ctx === ctx && lists.generation === generation) return lists.promise;
  const promise = source.playlists(ctx, { all: true });
  const mine = { ctx, generation, promise };
  lists = mine;
  promise.catch(() => {
    if (lists === mine) lists = undefined;
  });
  return promise;
}

/** The signed-in account's id, asked once per page; without it every playlist counts as "followed" for the filter. */
export function readAccount(
  source: NowPlayingSource,
  ctx: ConnectorContext,
): Promise<string | undefined> {
  if (!source.account) return Promise.resolve(undefined);
  if (account && account.ctx === ctx) return account.promise;
  const promise = source.account(ctx);
  const mine = { ctx, promise };
  account = mine;
  promise.catch(() => {
    if (account === mine) account = undefined;
  });
  return promise;
}

/** A playlist was made or changed: the next look at the tab reads the list again. */
export function changedPlaylists(): number {
  generation += 1;
  return generation;
}

/** Can this account change the playlist? Own ones, and shared ones others let you edit. */
export function canEdit(
  list: { ownerId?: string; collaborative?: boolean },
  me: string | undefined,
): boolean {
  return list.collaborative === true || (!!me && list.ownerId === me);
}

/** For tests. */
export function forgetLibrary(): void {
  lists = undefined;
  account = undefined;
}
