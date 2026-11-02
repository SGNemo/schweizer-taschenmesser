import { Channel, invoke } from '@tauri-apps/api/core';
import type { TorrentInfo, TorrentService, TorrentSource } from '../torrent';

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Bridge to `src-tauri/src/torrent.rs`. */
export function createTorrent(supported: boolean): TorrentService {
  if (!supported)
    return {
      supported: false,
      configure: unsupported,
      stop: unsupported,
      preview: unsupported,
      add: unsupported,
      pause: unsupported,
      resume: unsupported,
      remove: unsupported,
      watch: unsupported,
      pickFile: unsupported,
    };
  const input = (s: TorrentSource) => ({ kind: s.kind, value: s.value });
  return {
    supported: true,
    configure: (settings) => invoke<void>('torrent_configure', { settings }),
    stop: () => invoke<void>('torrent_stop'),
    preview: (source) =>
      invoke('torrent_preview', { input: input(source) }) as ReturnType<TorrentService['preview']>,
    add: (source, dir, files) =>
      invoke<number>('torrent_add', { input: input(source), dir, files: files ?? null }),
    pause: (id) => invoke<void>('torrent_pause', { id }),
    resume: (id) => invoke<void>('torrent_resume', { id }),
    remove: (id, deleteData) => invoke<void>('torrent_remove', { id, deleteData }),
    watch(onList) {
      const events = new Channel<TorrentInfo[]>();
      events.onmessage = onList;
      return invoke<void>('torrent_watch', { events });
    },
    async pickFile() {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({
        multiple: false,
        filters: [{ name: 'Torrent', extensions: ['torrent'] }],
      });
      return typeof picked === 'string' ? picked : null;
    },
  };
}
