import { useLiveQuery } from 'dexie-react-hooks';
import { useModuleStates } from './activation';
import { availableManifests } from '@/core/modules/available';
import { today } from '@/core/time/now';
import type {
  AttentionItem,
  CalendarItem,
  DateRange,
  DueNotification,
  ModuleManifest,
} from './types';

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
  return states ? availableManifests().filter((m) => states[m.id]) : [];
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

const TONE_ORDER: Record<AttentionItem['tone'], number> = { danger: 0, accent: 1, warning: 2 };
export const ATTENTION_LIMIT = 6;

/** Danger first, then accent, then warning; by rank and title inside a tone; capped. */
export function rankAttention(items: readonly AttentionItem[], limit = ATTENTION_LIMIT) {
  return [...items]
    .sort(
      (a, b) =>
        TONE_ORDER[a.tone] - TONE_ORDER[b.tone] ||
        (a.rank ?? 100) - (b.rank ?? 100) ||
        a.title.localeCompare(b.title, 'de'),
    )
    .slice(0, limit);
}

/** "Jetzt wichtig" items of all given (active) modules. A failing module never breaks the others. */
export async function collectAttention(
  day: string,
  manifests: readonly ModuleManifest[],
): Promise<AttentionItem[]> {
  const lists = await Promise.all(
    manifests.map(async (m) => {
      const load = m.contributions?.attention;
      if (!load) return [];
      try {
        return await (await load()).default({ today: day });
      } catch (e) {
        console.error(`[attention] source "${m.id}" failed`, e);
        return [];
      }
    }),
  );
  return rankAttention(lists.flat());
}

/** Live attention items; `undefined` while loading. */
export function useAttentionItems(): AttentionItem[] | undefined {
  const states = useModuleStates();
  const key = activeManifests(states)
    .map((m) => m.id)
    .join(',');
  return useLiveQuery(
    async () => (states ? collectAttention(today(), activeManifests(states)) : undefined),
    [key, states === undefined],
  );
}
