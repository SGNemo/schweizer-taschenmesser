/**
 * Native (Tauri 2) implementation of `PlatformService`. This directory is the only place that may
 * import `@tauri-apps/*` (ESLint). Keep each capability small and mockable.
 */
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { clear, readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { save } from '@tauri-apps/plugin-dialog';
import { BaseDirectory, mkdir, readDir, remove, writeFile } from '@tauri-apps/plugin-fs';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import {
  cancel,
  isPermissionGranted,
  pending,
  requestPermission,
  Schedule,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import type {
  NotificationPermissionState,
  NotificationService,
  ScheduledNotification,
} from '@/core/notifications/service';
import { onPageHidden, sensitiveClipboard } from '../web';
import type { PlatformKind, PlatformService, SaveFileRequest } from '../types';
import { createDesktopService } from './desktop';
import { createLocalApi } from './localApi';
import { createShare } from './share';
import { createSecureParts } from './secureStore';
import { createUpdater } from './updater';

const FILTER_NAMES: Record<string, string> = {
  json: 'JSON',
  csv: 'CSV',
  txt: 'Text',
};

async function toBytes(data: SaveFileRequest['data']): Promise<Uint8Array> {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return data;
}

const detectKind = (): PlatformKind =>
  /Android/i.test(navigator.userAgent) ? 'android' : 'desktop';

/**
 * `NotificationService.permission()` is synchronous, the plugin's check is not: the state is read
 * once at startup and refreshed whenever we ask for permission.
 */
/** Stable 31-bit id for a notification key (the plugin needs a 32-bit integer). */
export function notificationId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) & 0x7fffffff;
}

async function createNotifications(kind: PlatformKind): Promise<NotificationService> {
  let state: NotificationPermissionState = (await isPermissionGranted()) ? 'granted' : 'default';
  return {
    permission: () => state,
    async requestPermission() {
      const result = await requestPermission();
      state = result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'default';
      return state;
    },
    async show({ title, body }) {
      sendNotification({ title, body });
    },
    // Only the Android app hands reminders to the OS alarm manager; on desktop the app itself
    // fires them while it is running.
    scheduleUpcoming: kind === 'android' ? scheduleUpcoming : undefined,
  };
}

/** Replaces the pending OS notifications with `items`. */
async function scheduleUpcoming(items: ScheduledNotification[]): Promise<void> {
  const wanted = new Map(items.map((n) => [notificationId(n.key), n]));
  const stale = (await pending()).map((p) => p.id).filter((id) => !wanted.has(id));
  if (stale.length > 0) await cancel(stale);
  for (const [id, n] of wanted) {
    // Same id = replaces the earlier entry; `allowWhileIdle` lets it fire in Doze mode.
    sendNotification({
      id,
      title: n.title,
      body: n.body,
      schedule: Schedule.at(new Date(n.at), false, true),
      extra: { url: n.url ?? '/' },
    });
  }
}

const inAppData = { baseDir: BaseDirectory.AppData } as const;

export async function createTauriPlatform(): Promise<PlatformService> {
  const kind = detectKind();
  const fetchFn: typeof fetch = (input, init) => nativeFetch(input as string | URL | Request, init);
  return {
    kind,
    isNative: true,
    fetch: fetchFn,
    notifications: await createNotifications(kind),
    async saveFile(req) {
      const extension = req.fileName.split('.').pop()?.toLowerCase();
      const path = await save({
        defaultPath: req.fileName,
        filters: extension
          ? [{ name: FILTER_NAMES[extension] ?? extension.toUpperCase(), extensions: [extension] }]
          : undefined,
      });
      if (!path) return 'cancelled';
      await writeFile(path, await toBytes(req.data));
      return 'saved';
    },
    clipboard: {
      writeText: (text) => writeText(text),
      writeSensitive: sensitiveClipboard({
        write: (text) => writeText(text),
        read: () => readText().catch(() => undefined),
        clear: () => clear(),
      }),
    },
    app: {
      version: () => getVersion(),
      openUrl: (url) => openUrl(url),
    },
    files: {
      async write(path, data) {
        const dir = path.split('/').slice(0, -1).join('/');
        if (dir) await mkdir(dir, { ...inAppData, recursive: true });
        await writeFile(path, await toBytes(data), inAppData);
      },
      async list(dir) {
        try {
          return (await readDir(dir, inAppData)).filter((e) => e.isFile).map((e) => e.name);
        } catch {
          return []; // the folder does not exist yet
        }
      },
      remove: (path) => remove(path, inAppData),
    },
    updater: createUpdater(kind, fetchFn),
    oauth: {
      supported: kind === 'desktop',
      async start() {
        const port = await invoke<number>('oauth_listen_start');
        return {
          redirectUri: `http://127.0.0.1:${port}/callback`,
          wait: (state, timeoutSeconds = 300) =>
            invoke<{ code: string }>('oauth_listen_wait', {
              expectedState: state,
              timeoutSecs: timeoutSeconds,
            }),
        };
      },
    },
    localApi: createLocalApi(kind === 'desktop'),
    desktop: createDesktopService(kind === 'desktop'),
    share: createShare(kind === 'android'),
    ...(await createSecureParts(kind)), // secrets (OS keystore), biometrics, screen protection
    lifecycle: { onBackground: onPageHidden },
  };
}
