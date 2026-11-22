import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { TorrentInfo } from '@/core/platform/torrent';

interface TorrentsState {
  /** `undefined` until the engine delivered the first list. */
  torrents: TorrentInfo[] | undefined;
  /**
   * The engine was stopped outside the page (tray, closing into the tray while idle): nothing
   * starts it again until the user clicks (also after leaving and reopening the page).
   */
  stopped: boolean;
}

export const useTorrents = create<TorrentsState>(() => ({ torrents: undefined, stopped: false }));

/** Stopped outside the page: the list goes, the engine waits for a click. */
export function markStopped(): void {
  resetTorrents();
  useTorrents.setState({ stopped: true });
}

/** "Wieder starten", switching on, a changed switch, an opened link: the engine may start. */
export function clearStopped(): void {
  useTorrents.setState({ stopped: false });
}

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
