import { resyncNativeSchedule } from '@/core/notifications/nativeSchedule';
import { getPlatform } from '@/core/platform';
import { getFocusSettings } from '@/core/settings/focus';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import type { SavedCapture } from '../targets';
import { ensureAlertPermission } from './alertPermission';
import { reopenCapture } from './reopen';

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
  const { blocked, justGranted } = await ensureAlertPermission(
    saved.types ?? [saved.type],
    notifications,
  );
  // Android: put the new reminder into the OS alarms now, not at the next 10-minute run.
  if (justGranted) void resyncNativeSchedule().catch(() => undefined);
  const hint = blocked && (await getFocusSettings()).leadHint;
  const say = (text: string) => (hint ? t.quickCapture.alertsOff(text) : text);
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
