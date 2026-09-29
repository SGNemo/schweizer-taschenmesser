import { db } from '@/core/db/db';
import { activeManifests, collectNotifications } from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import type { DueNotification } from '@/core/modules/types';
import { now as clockNow } from '@/core/time/now';
import { getPlatform } from '@/core/platform';
import type { NotificationService } from './service';

/** Never replay more than a day of missed notifications after the app was closed for a long time. */
export const MAX_CATCH_UP_MS = 24 * 60 * 60 * 1000;
const CURSOR_KEY = 'notifyCursor';

export interface SchedulerDeps {
  service: Pick<NotificationService, 'permission' | 'show'>;
  loadDue(range: { from: number; to: number }): Promise<DueNotification[]>;
  getCursor(): Promise<number | undefined>;
  setCursor(at: number): Promise<void>;
  now(): number;
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
  if (deps.service.permission() !== 'granted') return 0;

  const from = Math.max(stored, now - MAX_CATCH_UP_MS);
  if (from >= now) return 0;
  const seen = new Set<string>();
  let shown = 0;
  for (const n of await deps.loadDue({ from, to: now })) {
    if (seen.has(n.key)) continue;
    seen.add(n.key);
    try {
      await deps.service.show({ title: n.title, body: n.body, tag: n.key, url: n.url });
      shown++;
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
      return collectNotifications(range, activeManifests(await loadModuleStates()));
    },
    getCursor: async () => (await meta.get(CURSOR_KEY))?.value,
    setCursor: async (at) => void (await meta.put({ key: CURSOR_KEY, value: at })),
    now: clockNow,
  };
}

const INTERVAL_MS = 30_000;

/**
 * Local scheduler: checks on start, every 30 s and whenever the app becomes visible again.
 * Works only while the app is open – see CLAUDE.md for the Web Push option (phase 6).
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
