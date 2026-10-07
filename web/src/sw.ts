/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import {
  asPayload,
  fallbackPayload,
  parsePushMessage,
  pushAad,
  type PushPayload,
} from '@/core/notifications/pushPayload';
import { decryptValue, isEncrypted } from '@/core/sync/crypto';

declare const self: ServiceWorkerGlobalScope;

// App shell: precache all build assets and serve index.html for navigations (offline SPA).
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// The page asks us to activate a waiting worker after the user accepted the update prompt.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Tapping a notification focuses the app (or opens it) at the given URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url: string = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clients[0];
      if (existing) {
        await existing.focus();
        if ('navigate' in existing) await existing.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

/** The sync key for encrypted push payloads lives in the app's IndexedDB (`_secrets.syncConfig`). */
function readSyncKey(): Promise<CryptoKey | undefined> {
  return new Promise((resolve) => {
    const open = indexedDB.open('taschenmesser');
    open.onerror = () => resolve(undefined);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('_secrets')) {
        db.close();
        return resolve(undefined);
      }
      const req = db.transaction('_secrets').objectStore('_secrets').get('syncConfig');
      req.onsuccess = () => {
        db.close();
        resolve((req.result as { value?: { key?: CryptoKey } } | undefined)?.value?.key);
      };
      req.onerror = () => {
        db.close();
        resolve(undefined);
      };
    };
  });
}

async function payloadOf(text: string): Promise<{ key?: string; payload: PushPayload }> {
  const message = parsePushMessage(text);
  if (!message) return { payload: fallbackPayload(self.navigator.languages) };
  try {
    if (!isEncrypted(message.payload)) {
      return {
        key: message.key,
        payload:
          asPayload(JSON.parse(message.payload)) ?? fallbackPayload(self.navigator.languages),
      };
    }
    const key = await readSyncKey();
    if (!key) return { key: message.key, payload: fallbackPayload(self.navigator.languages) };
    const plain = await decryptValue(key, pushAad(message.key), message.payload);
    return {
      key: message.key,
      payload: asPayload(plain) ?? fallbackPayload(self.navigator.languages),
    };
  } catch {
    return { key: message.key, payload: fallbackPayload(self.navigator.languages) };
  }
}

// Web Push (optional, via the user's sync server): show the notification even when the app is closed.
self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const { key, payload } = await payloadOf(event.data?.text() ?? '');
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        // Same tag as the local scheduler: a notification shown by both appears only once.
        tag: key,
        icon: '/pwa-192.png',
        badge: '/pwa-badge-96.png',
        data: { url: payload.url ?? '/' },
      });
    })(),
  );
});
