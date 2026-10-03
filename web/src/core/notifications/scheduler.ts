import { db } from '@/core/db/db';
import { activeManifests } from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import type { DueNotification } from '@/core/modules/types';
import { now as clockNow } from '@/core/time/now';
import { getPlatform } from '@/core/platform';
import { getFocusSettings } from '@/core/settings/focus';
import { collectDue } from './collect';
import { useReminderPrompts } from './inapp';
import type { NotificationService } from './service';
import { removeSnoozed } from './snooze';

/** Never replay more than a day of missed notifications after the app was closed for a long time. */
export const MAX_CATCH_UP_MS = 24 * 60 * 60 * 1000;
const CURSOR_KEY = 'notifyCursor';

export interface SchedulerDeps {
  service: Pick<NotificationService, 'permission' | 'show' | 'scheduleUpcoming'>;
  loadDue(range: { from: number; to: number }): Promise<DueNotification[]>;
  getCursor(): Promise<number | undefined>;
  setCursor(at: number): Promise<void>;
  now(): number;
  /** Shows the notification inside the app instead of the OS; returns true when it did. */
  present?(n: DueNotification): Promise<boolean>;
  /** Called after a notification was shown (used to remove "Später" entries). */
  consume?(n: DueNotification): Promise<void>;
}

/**
 * Fires every notification whose time lies in (cursor, now]. The cursor lives in the local `_meta`
 * table, so each occurrence fires once even across reloads. The first ever run only sets the cursor.
 * Returns the number of notifications shown.
 */
export async function checkDue(deps: SchedulerDeps): Promise<number> {
  const now = deps.now();
  const stored = await deps.getCursor();
  await deps.setCursor(now);
  if (stored === undefined) return 0;
  // The in-app card needs no OS permission; only the OS popup does.
  const canPopup = deps.service.permission() === 'granted';
  if (!canPopup && !deps.present) return 0;
  // The OS fires scheduled notifications itself (see nativeSchedule.ts); firing here would duplicate them.
  if (deps.service.scheduleUpcoming) return 0;

  const from = Math.max(stored, now - MAX_CATCH_UP_MS);
  if (from >= now) return 0;
  const seen = new Set<string>();
  let shown = 0;
  for (const n of await deps.loadDue({ from, to: now })) {
    if (seen.has(n.key)) continue;
    seen.add(n.key);
    try {
      const inApp = deps.present ? await deps.present(n) : false;
      if (!inApp) {
        if (!canPopup) continue;
        await deps.service.show({ title: n.title, body: n.body, tag: n.key, url: n.url });
      }
      shown++;
      await deps.consume?.(n);
    } catch (e) {
      console.error('[notifications] show failed', e);
    }
  }
  return shown;
}

function defaultDeps(): SchedulerDeps {
  const meta = db.table<{ key: string; value: number }, string>('_meta');
  return {
    service: getPlatform().notifications,
    async loadDue(range) {
      return collectDue(range, activeManifests(await loadModuleStates()));
    },
    getCursor: async () => (await meta.get(CURSOR_KEY))?.value,
    setCursor: async (at) => void (await meta.put({ key: CURSOR_KEY, value: at })),
    now: clockNow,
    // While the app is open the reminder appears in the app (Erledigt / Später), not as an OS popup.
    async present(n) {
      if (document.visibilityState !== 'visible') return false;
      if (!(await getFocusSettings()).inAppPrompt) return false;
      useReminderPrompts.getState().push({ key: n.key, title: n.title, body: n.body, url: n.url });
      return true;
    },
    async consume(n) {
      if (n.key.startsWith('snooze:')) await removeSnoozed(n.key);
    },
  };
}

const INTERVAL_MS = 30_000;

/**
 * Local scheduler: checks on start, every 30 s and whenever the app becomes visible again.
 * Works only while the app is open – see docs/architecture/extras.md for the Web Push option (phase 6).
 */
export function startNotificationScheduler(deps: SchedulerDeps = defaultDeps()): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await checkDue(deps);
    } catch (e) {
      console.error('[notifications] check failed', e);
    } finally {
      running = false;
    }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };
  void tick();
  const timer = setInterval(() => void tick(), INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
