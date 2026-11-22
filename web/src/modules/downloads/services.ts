/**
 * While the module is on nothing runs here; switching it off stops the torrent engine, so its peer
 * listener, DHT and trackers end with the module (security review 2026-11, DL2). The torrents stay
 * in the list, paused.
 */
import { getPlatform } from '@/core/platform';

export default function startDownloadsServices(): () => void {
  return () => {
    const torrent = getPlatform().torrent;
    if (torrent.supported) void torrent.stop().catch(() => undefined);
  };
}
