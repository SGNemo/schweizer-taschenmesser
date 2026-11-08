import type { NotificationService } from '@/core/notifications/service';
import type { CaptureType } from '../parser';

/**
 * C01 (Erstkontakt-Runde): a reminder typed into quick capture must be able to reach the user once
 * the app is closed. Saving one is the moment the user asked for an alert, so the save tap itself
 * asks the system once when nothing was decided yet ("default"); it never asks again after a "no".
 * Returns whether the saved toast should say that alerts are off.
 */
export async function ensureAlertPermission(
  types: readonly (CaptureType | undefined)[],
  notifications: Pick<NotificationService, 'permission' | 'requestPermission'>,
): Promise<{ blocked: boolean }> {
  if (!types.includes('reminder')) return { blocked: false };
  let state = notifications.permission();
  if (state === 'default') {
    try {
      state = await notifications.requestPermission();
    } catch {
      // A failing prompt (old WebView) must never stop the save.
    }
  }
  return { blocked: state === 'denied' || state === 'default' };
}
