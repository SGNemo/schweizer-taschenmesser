import type {
  ConnectorContext,
  MediaItem,
  NowPlayingSource,
  Playlist,
} from '@/core/connectors/types';

/**
 * The playlists tab's reads, kept only while the page is open (the connection context lives as long as the page): every
 * playlist (up to 1000, one request per 50) and the account id that tells own from followed. Switching tabs reads nothing
 * again; an edit (new playlist, new name) calls `changedPlaylists` so the next look reads afresh. A failure is not kept.
 */
let lists: { ctx: ConnectorContext; generation: number; promise: Promise<Playlist[]> } | undefined;
let account: { ctx: ConnectorContext; promise: Promise<string | undefined> } | undefined;
let generation = 0;
let albums:
  { ctx: ConnectorContext; generation: number; promise: Promise<MediaItem[]> } | undefined;
let albumGeneration = 0;

/** The saved albums, read once per page visit; saving or removing an album calls `changedAlbums`. */
export function readSavedAlbums(
  source: NowPlayingSource,
  ctx: ConnectorContext,
): Promise<MediaItem[]> {
  if (!source.savedAlbums) return Promise.resolve([]);
  if (albums && albums.ctx === ctx && albums.generation === albumGeneration) return albums.promise;
  const promise = source.savedAlbums(ctx);
  const mine = { ctx, generation: albumGeneration, promise };
  albums = mine;
  promise.catch(() => {
    if (albums === mine) albums = undefined;
  });
  return promise;
}

let follows:
  { ctx: ConnectorContext; generation: number; promise: Promise<MediaItem[]> } | undefined;
let followGeneration = 0;

/** The followed artists, read once per page visit; following or unfollowing calls `changedFollows`. */
export function readFollowedArtists(
  source: NowPlayingSource,
  ctx: ConnectorContext,
): Promise<MediaItem[]> {
  if (!source.followedArtists) return Promise.resolve([]);
  if (follows && follows.ctx === ctx && follows.generation === followGeneration)
    return follows.promise;
  const promise = source.followedArtists(ctx);
  const mine = { ctx, generation: followGeneration, promise };
  follows = mine;
  promise.catch(() => {
    if (follows === mine) follows = undefined;
  });
  return promise;
}

/** An artist was followed or unfollowed: the albums tab reads the followed artists afresh next time. */
export function changedFollows(): void {
  followGeneration += 1;
}

/** An album was saved or removed: the albums tab reads afresh next time. */
export function changedAlbums(): void {
  albumGeneration += 1;
}

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

/** Pages of the start view's read (`playlists` without `all`): a shorter answer is the whole list. */
const PICKER_MAX = 200;

/**
 * The start view's playlists: the short read (up to 200, 4 requests at most) so the page never waits for 1000. When the
 * answer is shorter than that, it is the whole list and the playlists tab takes it without asking again.
 */
export function readStartPlaylists(
  source: NowPlayingSource,
  ctx: ConnectorContext,
): Promise<Playlist[]> {
  if (!source.playlists) return Promise.resolve([]);
  if (lists && lists.ctx === ctx && lists.generation === generation) return lists.promise;
  const promise = source.playlists(ctx);
  const mine = { ctx, generation, promise };
  promise.then(
    (l) => {
      if (l.length < PICKER_MAX && !lists && mine.generation === generation) lists = mine;
    },
    () => undefined,
  );
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

/** Can this account change the playlist's songs? Own ones, and shared ones others let you edit. */
export function canEdit(
  list: { ownerId?: string; collaborative?: boolean },
  me: string | undefined,
): boolean {
  return list.collaborative === true || (!!me && list.ownerId === me);
}

/** Name and description can only be changed by the owner (Spotify refuses collaborators). */
export function canRename(list: { ownerId?: string }, me: string | undefined): boolean {
  return !!me && list.ownerId === me;
}

/** The page closed: nothing of the lists stays in memory. */
export function forgetLibrary(): void {
  // A read still on its way must not put the names back after the page closed.
  generation += 1;
  lists = undefined;
  account = undefined;
  albums = undefined;
  follows = undefined;
}
