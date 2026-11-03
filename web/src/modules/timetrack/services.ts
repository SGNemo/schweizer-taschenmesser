import { bus } from '@/core/events';
import { getSettings } from '@/core/settings/settings';
import { now } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { useIdle } from './idle';
import { idleMinutes } from './logic';
import { getRunning, startSession } from './repo';
import { settings, settingsSchema } from './settings';

/**
 * Runs while the module is on: starts a session on `timetrack.start.requested` and, when the app
 * comes back to the foreground after a gap longer than the setting while the timer runs, opens the
 * idle question (never changes anything by itself).
 */
export default function start(): () => void {
  let lastInput = now();
  const touch = () => {
    lastInput = now();
  };
  const check = async () => {
    if (document.visibilityState === 'hidden') return;
    const limit = (
      await getSettings('module.timetrack', settingsSchema, settings.defaults as never)
    ).idleMinutes;
    const gap = idleMinutes(lastInput, now());
    lastInput = now();
    if (limit <= 0 || gap < limit || useIdle.getState().since !== null) return;
    const running = await getRunning();
    if (!running || running.pausedAt) return;
    useIdle.getState().ask(now() - gap * 60_000, gap);
    useUiStore.getState().toast(t.timetrack.idle.toast(gap), {
      label: t.timetrack.idle.open,
      run: () => {
        // The router listens to popstate; a plain push keeps the app state.
        window.history.pushState({}, '', '/timetrack');
        window.dispatchEvent(new PopStateEvent('popstate'));
      },
    });
  };
  const events = ['pointerdown', 'keydown'] as const;
  events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
  const onVisible = () => void check();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  const off = bus.on('timetrack.start.requested', async (req) => {
    const title = req.title.trim();
    if (!title) return;
    await startSession(undefined, { from: title, note: title });
    useUiStore.getState().toast(t.timetrack.fromEvent.started(title));
  });
  return () => {
    events.forEach((e) => window.removeEventListener(e, touch));
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    off();
  };
}
