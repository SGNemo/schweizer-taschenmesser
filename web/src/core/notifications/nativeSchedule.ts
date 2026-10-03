/**
 * Hands the next two weeks of notifications to the operating system (Android app), so reminders
 * fire while the app is closed. The list is rebuilt from the modules' notification sources and
 * replaced as a whole whenever data changes; without OS support (browser, desktop) nothing happens.
 */
import type { TaschenmesserDB } from '@/core/db/db';
import { loadModuleStates } from '@/core/modules/activation';
import { activeManifests } from '@/core/modules/contributions';
import type { DueNotification } from '@/core/modules/types';
import { collectDue } from './collect';
import { getPlatform } from '@/core/platform';
import { now as clockNow } from '@/core/time/now';
import type { NotificationService, ScheduledNotification } from './service';
import { startScheduleTriggers } from './triggers';

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/** Android limits the number of alarms an app may hold; the earliest ones matter most. */
export const MAX_SCHEDULED = 100;

export interface NativeScheduleDeps {
  service: Pick<NotificationService, 'permission' | 'scheduleUpcoming'>;
  loadDue(range: { from: number; to: number }): Promise<DueNotification[]>;
  now(): number;
}

/** Upcoming, de-duplicated, earliest first, capped. */
export function pickUpcoming(
  due: readonly DueNotification[],
  from: number,
): ScheduledNotification[] {
  const unique = new Map<string, DueNotification>();
  for (const n of due) if (n.at > from && !unique.has(n.key)) unique.set(n.key, n);
  return [...unique.values()]
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED)
    .map(({ key, at, title, body, url }) => ({ key, at, title, body, url }));
}

/** Returns the number of notifications scheduled, or undefined when the platform cannot do it. */
export async function syncNativeSchedule(deps: NativeScheduleDeps): Promise<number | undefined> {
  const { service } = deps;
  if (!service.scheduleUpcoming || service.permission() !== 'granted') return undefined;
  const from = deps.now();
  const items = pickUpcoming(await deps.loadDue({ from, to: from + WINDOW_MS }), from);
  await service.scheduleUpcoming(items);
  return items.length;
}

function defaultDeps(): NativeScheduleDeps {
  return {
    service: getPlatform().notifications,
    async loadDue(range) {
      return collectDue(range, activeManifests(await loadModuleStates()));
    },
    now: clockNow,
  };
}

/** Keeps the OS schedule current. A no-op (returns a no-op stop function) where it is not supported. */
export function startNativeSchedule(
  deps: NativeScheduleDeps = defaultDeps(),
  database?: TaschenmesserDB,
): () => void {
  if (!deps.service.scheduleUpcoming) return () => undefined;
  return startScheduleTriggers(
    () =>
      void syncNativeSchedule(deps).catch((e) =>
        console.warn('[notifications] scheduling failed', e),
      ),
    database,
  );
}
