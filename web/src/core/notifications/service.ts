export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export interface ShowNotification {
  title: string;
  body?: string;
  /** Same tag replaces an existing notification – protects against duplicates (e.g. two tabs). */
  tag: string;
  url?: string;
}

/** A notification the operating system should show at `at` (epoch ms), even while the app is closed. */
export interface ScheduledNotification {
  /** Stable per occurrence; the same key replaces the earlier schedule entry. */
  key: string;
  at: number;
  title: string;
  body?: string;
  url?: string;
}

/** Abstraction over the platform's notifications (browser API, native plugin). */
export interface NotificationService {
  permission(): NotificationPermissionState;
  requestPermission(): Promise<NotificationPermissionState>;
  show(n: ShowNotification): Promise<void>;
  /**
   * Only where the OS can fire notifications by itself (the Android app): replaces the whole set of
   * pending scheduled notifications. When present, the in-app scheduler stays quiet to avoid duplicates.
   */
  scheduleUpcoming?(items: ScheduledNotification[]): Promise<void>;
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
