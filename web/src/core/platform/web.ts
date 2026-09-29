import { localNotificationService } from '@/core/notifications/service';
import type { PlatformService, SaveFileRequest } from './types';

/** Injected at build time from `web/package.json` (see vite.config.ts). */
declare const __APP_VERSION__: string;

const toBlob = (req: SaveFileRequest): Blob =>
  req.data instanceof Blob ? req.data : new Blob([req.data as BlobPart], { type: req.mime });

export function browserDownload(req: SaveFileRequest): void {
  const url = URL.createObjectURL(toBlob(req));
  const a = document.createElement('a');
  a.href = url;
  a.download = req.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before releasing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Shared by both implementations: hidden page = background (also fires when a window is minimised). */
export function onPageHidden(callback: () => void): () => void {
  const handler = () => {
    if (document.visibilityState === 'hidden') callback();
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

/** Clipboard helper on top of any pair of read/write/clear primitives. */
export function sensitiveClipboard(io: {
  write(text: string): Promise<void>;
  read(): Promise<string | undefined>;
  clear(): Promise<void>;
}): (text: string, clearAfterMs: number) => Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return async (text, clearAfterMs) => {
    clearTimeout(timer);
    await io.write(text);
    timer = setTimeout(() => {
      void (async () => {
        try {
          // Do not wipe something the user copied in the meantime; if we cannot tell, wipe.
          const current = await io.read().catch(() => text);
          if (current === undefined || current === text) await io.clear();
        } catch {
          // Clipboard access can be denied (page not focused); nothing more we can do.
        }
      })();
    }, clearAfterMs);
  };
}

export function createWebPlatform(): PlatformService {
  return {
    kind: 'web',
    isNative: false,
    fetch: (input, init) => fetch(input, init),
    notifications: localNotificationService,
    async saveFile(req) {
      browserDownload(req);
      return 'saved';
    },
    clipboard: {
      writeSensitive: sensitiveClipboard({
        write: (text) => navigator.clipboard.writeText(text),
        read: () => navigator.clipboard.readText(),
        clear: () => navigator.clipboard.writeText(''),
      }),
    },
    app: {
      version: async () => (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'),
      async openUrl(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      },
    },
    lifecycle: { onBackground: onPageHidden },
  };
}
