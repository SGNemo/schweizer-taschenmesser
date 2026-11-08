import { resyncNativeSchedule } from '@/core/notifications/nativeSchedule';
import { getPlatform } from '@/core/platform';
import { getFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { SavedCapture } from '../targets';
import { ensureAlertPermission, type AlertCheck } from './alertPermission';
import { reopenCapture } from './reopen';

/** C01: asks for alerts when a reminder was saved; a failure here never costs the toast. */
async function alertLine(
  saved: SavedCapture,
  notifications: Parameters<typeof ensureAlertPermission>[1],
) {
  try {
    const check: AlertCheck = await ensureAlertPermission(
      saved.types ?? [saved.type],
      notifications,
    );
    // Android: put the new reminder into the OS alarms now, not at the next 10-minute run.
    if (check.justGranted) void resyncNativeSchedule().catch(() => undefined);
    if (!check.off || !(await getFocusSettings()).leadHint) return undefined;
    return check.off === 'denied' ? t.quickCapture.alertsBlocked : t.quickCapture.alertsOff;
  } catch {
    return undefined;
  }
}

/**
 * Toast "Gespeichert in …" with an undo action; used wherever the main app window saved a capture.
 * Several entries at once: "3 Dinge gespeichert · Ändern" takes all of them back and puts the text
 * into the capture sheet again. A saved reminder asks for notification permission once (C01); when
 * alerts stay off, the same toast says where to turn them on (switch: Fokus → `leadHint`).
 */
export async function announceSaved(
  saved: SavedCapture,
  notifications = getPlatform().notifications,
): Promise<void> {
  const { toast } = useUiStore.getState();
  const extra = await alertLine(saved, notifications);
  const say = (text: string) => (extra ? extra(text) : text);
  if (saved.count && saved.count > 1) {
    const text = saved.text ?? '';
    toast(say(t.quickCapture.multi.saved(saved.count)), {
      label: t.quickCapture.multi.change,
      run: () => void saved.undo().then(() => reopenCapture(text)),
    });
    return;
  }
  toast(say(t.quickCapture.saved(t.quickCapture.target[saved.type])), {
    label: t.quickCapture.undo,
    run: () => void saved.undo().then(() => toast(t.quickCapture.undone)),
  });
}
