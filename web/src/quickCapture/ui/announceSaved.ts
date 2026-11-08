import { loadModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
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
 * Where „Ansehen“ after a batch leads: the planner when it is on, else the ToDo inbox with „Eingang
 * sortieren“; nowhere (no „Ansehen“) when neither is on.
 */
export async function batchPlace(): Promise<string | undefined> {
  try {
    const states = await loadModuleStates(visibleManifests);
    return states.planner ? '/planner' : states.todos ? '/todos?list=inbox' : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Toast "Gespeichert in …" with an undo action; used wherever the main app window saved a capture.
 * Several entries at once (U05): "5 Dinge gespeichert. Sortiert wird später. · Ansehen · Rückgängig" –
 * „Ansehen“ (only where the caller can navigate) opens the place they landed, „Rückgängig“ takes all
 * of them back and puts the text into the capture sheet again, so nothing typed is lost. A saved
 * reminder asks for notification permission once (C01); when alerts stay off, the same toast says
 * where to turn them on (switch: Fokus → `leadHint`).
 */
export async function announceSaved(
  saved: SavedCapture,
  notifications = getPlatform().notifications,
  navigate?: (to: string) => void,
): Promise<void> {
  const { toast } = useUiStore.getState();
  const extra = await alertLine(saved, notifications);
  const say = (text: string) => (extra ? extra(text) : text);
  if (saved.count && saved.count > 1) {
    const text = saved.text ?? '';
    const place = navigate ? await batchPlace() : undefined;
    toast(
      say(t.quickCapture.multi.saved(saved.count)),
      {
        label: t.quickCapture.undo,
        run: () => void saved.undo().then(() => reopenCapture(text)),
      },
      undefined,
      place ? { label: t.quickCapture.multi.view, run: () => navigate!(place) } : undefined,
    );
    return;
  }
  toast(say(t.quickCapture.saved(t.quickCapture.target[saved.type])), {
    label: t.quickCapture.undo,
    run: () => void saved.undo().then(() => toast(t.quickCapture.undone)),
  });
}
