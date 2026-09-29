/**
 * Native (Tauri 2) implementation of `PlatformService`. This directory is the only place that may
 * import `@tauri-apps/*` (ESLint). Keep each capability small and mockable.
 */
import { getVersion } from '@tauri-apps/api/app';
import { clear, readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { fetch as nativeFetch } from '@tauri-apps/plugin-http';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { openUrl } from '@tauri-apps/plugin-opener';
import type {
  NotificationPermissionState,
  NotificationService,
} from '@/core/notifications/service';
import { onPageHidden, sensitiveClipboard } from '../web';
import type { PlatformKind, PlatformService, SaveFileRequest } from '../types';

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
async function createNotifications(): Promise<NotificationService> {
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
  };
}

export async function createTauriPlatform(): Promise<PlatformService> {
  const kind = detectKind();
  return {
    kind,
    isNative: true,
    fetch: (input, init) => nativeFetch(input as string | URL | Request, init),
    notifications: await createNotifications(),
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
    lifecycle: { onBackground: onPageHidden },
  };
}
