import { useLiveQuery } from 'dexie-react-hooks';
import { useModuleStates } from './activation';
import { visibleManifests } from './registry';
import type { CalendarItem, DateRange, DueNotification, ModuleManifest } from './types';

export function compareCalendarItems(a: CalendarItem, b: CalendarItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1; // all-day first
  const ta = a.time ?? '';
  const tb = b.time ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title, 'de');
}

/** Calendar items from all given (active) modules. A failing module never breaks the others. */
export async function collectCalendarItems(
  range: DateRange,
  manifests: readonly ModuleManifest[],
): Promise<CalendarItem[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.calendarItems;
      if (!load) return [];
      try {
        return await (await load()).default(range);
      } catch (e) {
        console.error(`[calendar] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat().sort(compareCalendarItems);
}

/** Notifications due in (from, to] from all given (active) modules, oldest first. */
export async function collectNotifications(
  range: { from: number; to: number },
  manifests: readonly ModuleManifest[],
): Promise<DueNotification[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.notifications;
      if (!load) return [];
      try {
        return await (await load()).default(range);
      } catch (e) {
        console.error(`[notifications] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return lists.flat().sort((a, b) => a.at - b.at);
}

export function activeManifests(states: Record<string, boolean> | undefined): ModuleManifest[] {
  return states ? visibleManifests.filter((m) => states[m.id]) : [];
}

/** Live calendar items of all active modules for a date range; `undefined` while loading. */
export function useCalendarItems(range: DateRange): CalendarItem[] | undefined {
  const states = useModuleStates();
  const key = activeManifests(states)
    .map((m) => m.id)
    .join(',');
  return useLiveQuery(
    async () => (states ? collectCalendarItems(range, activeManifests(states)) : undefined),
    [range.from, range.to, key, states === undefined],
  );
}
