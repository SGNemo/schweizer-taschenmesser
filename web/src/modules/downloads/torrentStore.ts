import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { TorrentInfo } from '@/core/platform/torrent';

interface TorrentsState {
  /** `undefined` until the engine delivered the first list. */
  torrents: TorrentInfo[] | undefined;
}

export const useTorrents = create<TorrentsState>(() => ({ torrents: undefined }));

let watching = false;

/** Starts watching the engine's list once (call after `configure` succeeded). */
export function watchTorrents(): void {
  const service = getPlatform().torrent;
  if (watching || !service.supported) return;
  watching = true;
  service
    .watch((torrents) => useTorrents.setState({ torrents }))
    .catch(() => {
      watching = false;
    });
}

/** After the engine was switched off the list is gone and the next start watches again. */
export function resetTorrents(): void {
  watching = false;
  useTorrents.setState({ torrents: undefined });
}
