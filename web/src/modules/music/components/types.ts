import type { MediaItem } from '@/core/connectors/types';
import type { NowPlayingHandle } from '../useNowPlaying';

/** Where "Zurück" leads from a list: the tab or the artist page it was opened from. */
export type Back = 'start' | 'playlists' | 'albums' | { artist: string; name: string };

/** What the player's main pane shows. `back`: the way back offered in the list's head (none = opened from a tab). */
export type View =
  | { type: 'playlist'; id: string; name: string; back?: Back }
  | { type: 'album'; id: string; name: string; back?: Back }
  | { type: 'artist'; id: string; name: string; back?: Back }
  | { type: 'liked' }
  | { type: 'recent'; back?: Back }
  | { type: 'queue' }
  | { type: 'search' }
  | { type: 'playlists' }
  | { type: 'albums' };

/** The view a `back` leads to (`undefined` = the start view). */
export function backView(back: Back): View | undefined {
  if (back === 'start') return undefined;
  if (back === 'playlists' || back === 'albums') return { type: back };
  return { type: 'artist', id: back.artist, name: back.name };
}

export const viewKey = (v: View): string => ('id' in v ? `${v.type}:${v.id}` : v.type);

/** The state and actions every part of the player shares. */
export interface PlayerApi {
  np: NowPlayingHandle;
  /** Runs a player action, then reads the player again; `false` shows "Abspielen hat nicht geklappt". */
  act(action: () => Promise<void>): Promise<boolean>;
  /** Id of the song that plays now. */
  playingId?: string;
  /** Opens another list in the main pane (an album or playlist found by the search). */
  open(view: View | undefined): void;
  /** Bumps after every player action, so the queue view reads again. */
  version: number;
  /** Starts a song of a plain list (saved, recent, search): it plays, followed by the rest of the list. */
  playFromList(item: MediaItem, list: readonly MediaItem[]): Promise<boolean>;
}

/** Id of a track from its Spotify link (`https://open.spotify.com/track/<id>`), if it is one. */
export function trackIdOf(url: string | undefined): string | undefined {
  return url?.match(/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{1,40})(?:[/?#]|$)/)?.[1];
}
