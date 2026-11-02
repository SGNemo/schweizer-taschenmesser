/**
 * Native (Tauri 2) implementation of `PlatformService`. This directory is the only place that may
 * import `@tauri-apps/*` (ESLint). Keep each capability small and mockable.
 */
import { loggedFetch } from '@/core/net/netlog';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { clear, readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { save } from '@tauri-apps/plugin-dialog';
import {
  BaseDirectory,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeFile,
} from '@tauri-apps/plugin-fs';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import {
  cancel,
  createChannel,
  Importance,
  isPermissionGranted,
  pending,
  requestPermission,
  Schedule,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import { tComfort } from '@/strings.comfort';
import type {
  NotificationPermissionState,
  NotificationService,
  ScheduledNotification,
} from '@/core/notifications/service';
import { onPageHidden, sensitiveClipboard } from '../web';
import type { PlatformKind, PlatformService, SaveFileRequest } from '../types';
import { createDesktopService } from './desktop';
import { createDisplay } from './display';
import { createDisk } from './disk';
import { createLocalApi } from './localApi';
import { createVaultBridge } from './vaultBridge';
import { createShare } from './share';
import { createLocalModel } from './localModel';
import { createBrowser } from './browser';
import { createSystem } from './system';
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
    async show({ title, body, quiet }) {
      // Android needs a monochrome status-bar icon (`res/drawable/ic_notification`, rendered by
      // gen-icons); the launcher icon would appear as a white square. Desktop uses the app icon.
      // "Stumm" on Android: the low-importance channel shows it without sound.
      if (kind === 'android' && quiet) await ensureQuietChannel();
      sendNotification(
        kind === 'android'
          ? { title, body, ...ANDROID_ICON, ...(quiet ? { channelId: QUIET_CHANNEL } : {}) }
          : { title, body },
      );
    },
    // Only the Android app hands reminders to the OS alarm manager; on desktop the app itself
    // fires them while it is running.
    scheduleUpcoming: kind === 'android' ? scheduleUpcoming : undefined,
  };
}

/** Small icon + accent tint for Android notifications (drawable name, see `scripts/gen-icons.mjs`). */
const ANDROID_ICON = { icon: 'ic_notification', iconColor: '#E0550F' } as const;

/** Android channel without sound for "Stumm" (created once; the plugin ignores a repeat). */
const QUIET_CHANNEL = 'nemo-quiet';
let quietChannel: Promise<void> | undefined;
function ensureQuietChannel(): Promise<void> {
  quietChannel ??= createChannel({
    id: QUIET_CHANNEL,
    name: tComfort.get().mute.channel,
    importance: Importance.Low,
    vibration: false,
  }).catch(() => undefined);
  return quietChannel;
}

/** Replaces the pending OS notifications with `items`. */
async function scheduleUpcoming(items: ScheduledNotification[]): Promise<void> {
  const wanted = new Map(items.map((n) => [notificationId(n.key), n]));
  if (items.some((n) => n.quiet)) await ensureQuietChannel();
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
      ...ANDROID_ICON,
      ...(n.quiet ? { channelId: QUIET_CHANNEL } : {}),
    });
  }
}

const inAppData = { baseDir: BaseDirectory.AppData } as const;

export async function createTauriPlatform(): Promise<PlatformService> {
  const kind = detectKind();
  const fetchFn: typeof fetch = loggedFetch((input, init) =>
    nativeFetch(input as string | URL | Request, init),
  );
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
      ...sensitiveClipboard({
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
      read: (path) => readTextFile(path, inAppData),
    },
    updater: createUpdater(kind, fetchFn),
    oauth: {
      supported: kind === 'desktop',
      async start(opts) {
        const port = await invoke<number>('oauth_listen_start', {
          preferredPort: opts?.preferredPort,
        });
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
    vaultBridge: createVaultBridge(kind === 'desktop'),
    disk: createDisk(kind === 'desktop'),
    system: createSystem(kind === 'desktop'),
    browser: createBrowser(kind === 'desktop'),
    localModel: createLocalModel(kind === 'desktop'),
    desktop: createDesktopService(kind === 'desktop'),
    share: createShare(kind === 'android'),
    display: createDisplay(kind),
    ...(await createSecureParts(kind)), // secrets (OS keystore), biometrics, screen protection
    lifecycle: { onBackground: onPageHidden },
  };
}
