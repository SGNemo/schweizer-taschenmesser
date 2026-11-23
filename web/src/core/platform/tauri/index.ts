/**
 * Native (Tauri 2) implementation of `PlatformService`. This directory is the only place that may
 * import `@tauri-apps/*` (ESLint). Keep each capability small and mockable.
 */
import { lockScreenVisibility } from '@/core/notifications/lockScreen';
import { loggedFetch } from '@/core/net/netlog';
import { now } from '@/core/time/now';
import { checkRedirect, nativeInit } from './redirect';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { clear, readText, writeSecret, writeText } from '@tauri-apps/plugin-clipboard-manager';
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
import { t } from '@/strings';
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
import { createLanHub } from './lanHub';
import { createRemote } from './remote';
import { createRemoteHost } from './remoteHost';
import { createExchange } from './exchange';
import { createLanClient } from './lanClient';
import { createLanWatch } from './lanWatch';
import { createVaultBridge } from './vaultBridge';
import { createShare } from './share';
import { createLocalModel } from './localModel';
import { createBrowser } from './browser';
import { createCustomTabs } from './customTabs';
import { createDeviceWipe } from './deviceWipe';
import { createLaunch } from './launch';
import { createDownloads } from './downloads';
import { createTorrent } from './torrent';
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
      const channelId = kind === 'android' ? await channelFor(quiet === true) : undefined;
      sendNotification(
        kind === 'android'
          ? { title, body, ...ANDROID_ICON, ...(channelId ? { channelId } : {}) }
          : { title, body },
      );
    },
    // Only the Android app hands reminders to the OS alarm manager; on desktop the app itself
    // fires them while it is running.
    scheduleUpcoming: kind === 'android' ? scheduleUpcoming : undefined,
  };
}

/** Small icon + accent tint for Android notifications (drawable name, see `scripts/gen-icons.mjs`). */
const ANDROID_ICON = { icon: 'ic_notification', iconColor: '#b5430c' } as const;

/**
 * Android channels (each created once; the plugin ignores a repeat). NS6 (launch review 2026-11):
 * what a locked phone shows is decided by the channel. A notice's own `visibility` never reaches
 * Android: the plugin's Rust `NotificationData` has no such field and drops it. A channel's
 * lock-screen setting overrides the notice and cannot change after creation, so:
 *  - default (switch off): `nemo-hidden` / `nemo-quiet-hidden`, both "secret" (nothing on the lock
 *    screen; in the notification shade after unlocking);
 *  - "Inhalt auf dem Sperrbildschirm zeigen": the plugin's own `default` channel (no override,
 *    Android's lock-screen setting decides) / `nemo-quiet` (private, created by earlier versions).
 * Created channels play the sound as a notification; the plugin's `default` channel as an alarm,
 * so under Do Not Disturb the two may differ.
 */
const QUIET_CHANNEL = 'nemo-quiet';
const QUIET_HIDDEN_CHANNEL = 'nemo-quiet-hidden';
const HIDDEN_CHANNEL = 'nemo-hidden';
const channels = new Map<string, Promise<void>>();

/** The channel for a notice now: `undefined` = the plugin's default channel. */
async function channelFor(quiet: boolean): Promise<string | undefined> {
  const hidden = lockScreenVisibility() === -1;
  const id = quiet
    ? hidden
      ? QUIET_HIDDEN_CHANNEL
      : QUIET_CHANNEL
    : hidden
      ? HIDDEN_CHANNEL
      : undefined;
  if (!id) return undefined;
  if (!channels.has(id))
    channels.set(
      id,
      createChannel({
        id,
        name:
          id === QUIET_CHANNEL
            ? tComfort.get().mute.channel
            : id === QUIET_HIDDEN_CHANNEL
              ? t.notifications.channelQuietHidden
              : t.notifications.channelHidden,
        importance: quiet ? Importance.Low : Importance.Default,
        // no new stimulus: like the plugin's default channel, it does not vibrate (FOCUS-GUIDELINES)
        vibration: false,
        visibility: hidden ? -1 : 0,
      }).catch(() => undefined),
    );
  await channels.get(id);
  return id;
}

/**
 * Device-local list of the alarm ids Nemo handed to Android and their fire times (localStorage, never synced). Needed
 * because tauri-plugin-notification 2.7.0 does not store notices scheduled via `sendNotification`,
 * so `pending()` misses them; `cancel(ids)` still stops their alarms
 * (docs/features/android-scheduled-reminders.md).
 */
export const ALARM_IDS_KEY = 'tm-native-alarm-ids';

/** An alarm Nemo handed to Android: its id and when it fires (absent in lists of older versions). */
type AlarmEntry = [id: number, at: number | undefined];

function readAlarms(): AlarmEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(ALARM_IDS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((e): AlarmEntry[] => {
      if (Number.isInteger(e)) return [[e as number, undefined]]; // older list: ids only
      if (Array.isArray(e) && Number.isInteger(e[0]))
        return [[e[0] as number, typeof e[1] === 'number' ? e[1] : undefined]];
      return [];
    });
  } catch {
    return [];
  }
}

function writeAlarms(entries: Iterable<AlarmEntry>): void {
  try {
    localStorage.setItem(ALARM_IDS_KEY, JSON.stringify([...entries]));
  } catch {
    // storage full or blocked: the next run cancels by the plugin's list only
  }
}

/** Replaces the pending OS notifications with `items`. */
async function scheduleUpcoming(items: ScheduledNotification[]): Promise<void> {
  const wanted = new Map(items.map((n) => [notificationId(n.key), n]));
  const normalId = await channelFor(false);
  const quietId = items.some((n) => n.quiet) ? await channelFor(true) : normalId;
  const listed = await pending().then(
    (list) => list.map((p) => p.id),
    () => [] as number[],
  );
  // The plugin's `cancel(id)` also dismisses a shown notice with that id: an alarm whose time has
  // passed already fired and is only gone from `items` because it is no longer upcoming, so it is
  // never cancelled (it would vanish from the shade unread). Entries of older lists carry no time.
  const at = now();
  const known = new Map<number, number | undefined>(readAlarms());
  for (const id of listed) if (!known.has(id)) known.set(id, undefined);
  const stale = [...known]
    .filter(([id, when]) => !wanted.has(id) && (when === undefined || when > at))
    .map(([id]) => id);
  if (stale.length > 0) await cancel(stale);
  // Recorded before scheduling, so an interrupted run still cancels them next time.
  writeAlarms([...wanted].map(([id, n]): AlarmEntry => [id, n.at]));
  for (const [id, n] of wanted) {
    // Same id = replaces the earlier entry; `allowWhileIdle` lets it fire in Doze mode.
    sendNotification({
      id,
      title: n.title,
      body: n.body,
      schedule: Schedule.at(new Date(n.at), false, true),
      extra: { url: n.url ?? '/' },
      ...ANDROID_ICON,
      // NS6: the channel decides what a locked phone shows (see `channelFor`)
      ...((n.quiet ? quietId : normalId) ? { channelId: n.quiet ? quietId : normalId } : {}),
    });
  }
}

const inAppData = { baseDir: BaseDirectory.AppData } as const;

export async function createTauriPlatform(): Promise<PlatformService> {
  const kind = detectKind();
  const fetchFn: typeof fetch = loggedFetch((input, init) =>
    nativeFetch(input as string | URL | Request, nativeInit(init)).then((res) =>
      checkRedirect(res, init),
    ),
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
        // NS8: marked sensitive (Android: no preview; Windows: not in history or cloud clipboard)
        write: (text) => writeSecret(text),
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
    lanHub: createLanHub(kind === 'desktop'),
    remoteHost: createRemoteHost(kind === 'desktop'),
    remote: createRemote(kind === 'android'),
    exchange: createExchange(kind === 'desktop' ? 'pc' : kind === 'android' ? 'phone' : null),
    lanClient: createLanClient(kind === 'android' || kind === 'desktop'),
    lanWatch: createLanWatch(kind === 'android'),
    deviceWipe: createDeviceWipe(kind === 'android' || kind === 'desktop'),
    disk: createDisk(kind === 'desktop'),
    system: createSystem(kind === 'desktop'),
    browser: createBrowser(kind === 'desktop'),
    customTabs: createCustomTabs(kind === 'android'),
    launch: createLaunch(kind === 'desktop'),
    downloads: createDownloads(kind === 'desktop'),
    torrent: createTorrent(kind === 'desktop'),
    localModel: createLocalModel(kind === 'desktop'),
    desktop: createDesktopService(kind === 'desktop'),
    share: createShare(kind === 'android'),
    display: createDisplay(kind),
    ...(await createSecureParts(kind)), // secrets (OS keystore), biometrics, screen protection
    lifecycle: { onBackground: onPageHidden },
  };
}
