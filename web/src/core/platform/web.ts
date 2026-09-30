import { createFakeLocalApi } from './fakeLocalApi';
import { createDeviceKeyStore } from '@/core/secrets/deviceKey';
import { localNotificationService } from '@/core/notifications/service';
import type { PlatformKind, PlatformService, SaveFileRequest } from './types';

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

/** E2E builds only: lets a browser test pose as another platform (`localStorage.__tmPlatformKind`). */
function e2eKind(): PlatformKind {
  try {
    const v = localStorage.getItem('__tmPlatformKind');
    if (v === 'desktop' || v === 'android') return v;
  } catch {
    // Storage blocked: stay a plain browser.
  }
  return 'web';
}

const unsupported = (): Promise<never> => Promise.reject(new Error('Not available in the browser'));

export function createWebPlatform(): PlatformService {
  return {
    kind: import.meta.env.MODE === 'e2e' ? e2eKind() : 'web',
    isNative: false,
    fetch: (input, init) => fetch(input, init),
    notifications: localNotificationService,
    async saveFile(req) {
      browserDownload(req);
      return 'saved';
    },
    clipboard: {
      writeText: (text) => navigator.clipboard.writeText(text),
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
    files: {
      write: unsupported,
      list: unsupported,
      remove: unsupported,
    },
    // The PWA updates through its service worker (see pwa/UpdatePrompt).
    updater: {
      supported: false,
      check: async () => undefined,
      install: unsupported,
    },
    // OS keystore (Windows Credential Manager / Android Keystore) is planned as step 11b.
    secrets: createDeviceKeyStore(),
    // No biometric hardware access from a web page.
    biometrics: {
      available: async () => false,
      seal: unsupported,
      unseal: unsupported,
      has: async () => false,
      remove: async () => undefined,
    },
    screen: { setSecure: async () => undefined },
    // No listening sockets in a browser: OAuth logins that need a loopback redirect are desktop-only.
    oauth: { supported: false, start: unsupported },
    // E2E builds only: a stand-in for the native server (the branch is removed from other builds).
    localApi:
      import.meta.env.MODE === 'e2e'
        ? createFakeLocalApi()
        : { supported: false, start: unsupported, setTokens: unsupported, stop: async () => {} },
    lifecycle: { onBackground: onPageHidden },
  };
}
