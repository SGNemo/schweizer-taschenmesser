import type { NotificationService } from '@/core/notifications/service';
import type { CaptureType } from '../parser';

/** Device-local: quick capture asked once already (Android reports "default" again after a "no"). */
const ASKED_KEY = 'tm-alerts-asked';

const askedBefore = (): boolean => {
  try {
    return localStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
};
const markAsked = (): void => {
  try {
    localStorage.setItem(ASKED_KEY, '1');
  } catch {
    // storage blocked: the OS still limits its own prompts
  }
};

export interface AlertCheck {
  /** Alerts stay off: "denied" = blocked in the system, "default" = not allowed (yet). */
  off?: 'denied' | 'default';
  /** The user just allowed alerts with this save. */
  justGranted?: boolean;
}

/**
 * C01 (Erstkontakt-Runde): a reminder typed into quick capture must be able to reach the user once
 * the app is closed. Saving the first one is the moment the user asked for an alert, so that save
 * asks the system once; quick capture never asks again on this device, also not after a dismissed
 * prompt (FOCUS-GUIDELINES: no re-asking after "no"). The toast then says alerts are off.
 */
export async function ensureAlertPermission(
  types: readonly (CaptureType | undefined)[],
  notifications: Pick<NotificationService, 'permission' | 'requestPermission'>,
): Promise<AlertCheck> {
  if (!types.includes('reminder')) return {};
  let state = notifications.permission();
  if (state === 'default' && !askedBefore()) {
    try {
      state = await notifications.requestPermission();
      markAsked(); // answered or dismissed: never again; a prompt that failed to show may retry
      // The save already passed the OS schedule while alerts were still undecided: rebuild it.
      if (state === 'granted') return { justGranted: true };
    } catch {
      // A failing prompt (old WebView) must never stop the save.
    }
  }
  return state === 'denied' || state === 'default' ? { off: state } : {};
}
