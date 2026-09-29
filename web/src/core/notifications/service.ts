export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface ShowNotification {
  title: string;
  body?: string;
  /** Same tag replaces an existing notification – protects against duplicates (e.g. two tabs). */
  tag: string;
  url?: string;
}

/** Abstraction over the platform so a Web Push implementation can be added later. */
export interface NotificationService {
  permission(): NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
  show(n: ShowNotification): Promise<void>;
}

export const localNotificationService: NotificationService = {
  permission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  },
  async requestPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.requestPermission();
  },
  async show({ title, body, tag, url }) {
    const options: NotificationOptions = {
      body,
      tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: url ?? '/' },
    };
    // Android Chrome only supports notifications through the service worker registration.
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  },
};
