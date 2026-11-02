import { Channel, invoke } from '@tauri-apps/api/core';
import type { DownloadJob, DownloadsService } from '../downloads';

const unsupported = (): Promise<never> => Promise.reject(new Error('unsupported'));

/** Bridge to `src-tauri/src/downloads.rs`. */
export function createDownloads(supported: boolean): DownloadsService {
  if (!supported)
    return {
      supported: false,
      watch: unsupported,
      defaultDir: unsupported,
      pickDir: unsupported,
      add: unsupported,
      pause: unsupported,
      resume: unsupported,
      remove: unsupported,
      setLimit: unsupported,
      setJobLimit: unsupported,
      verify: unsupported,
      reveal: unsupported,
    };
  return {
    supported: true,
    watch(onList) {
      const events = new Channel<DownloadJob[]>();
      events.onmessage = onList;
      return invoke<void>('downloads_watch', { events });
    },
    defaultDir: () => invoke<string>('downloads_default_dir'),
    async pickDir() {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({ directory: true, multiple: false });
      return typeof picked === 'string' ? picked : null;
    },
    add: (url, dir, expectedHash) =>
      invoke<DownloadJob>('downloads_add', { url, dir, expectedHash: expectedHash || null }),
    pause: (id) => invoke<void>('downloads_pause', { id }),
    resume: (id) => invoke<void>('downloads_resume', { id }),
    remove: (id, deleteData) => invoke<void>('downloads_remove', { id, deleteData }),
    setLimit: (bps) => invoke<void>('downloads_set_limit', { bps }),
    setJobLimit: (id, bps) => invoke<void>('downloads_set_job_limit', { id, bps }),
    verify: (id, expected) => invoke<void>('downloads_verify', { id, expected }),
    reveal: (id) => invoke<void>('downloads_reveal', { id }),
  };
}
