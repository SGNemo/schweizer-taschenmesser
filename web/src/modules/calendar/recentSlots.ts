import type { CalendarEvent } from './schema';

/** A title with a fixed start and end, e.g. a shift ("Frühdienst 06:00–14:30"). */
export interface Slot {
  title: string;
  startTime: string;
  endTime: string;
}

/**
 * The slots the user entered most recently, newest first, each once. They are offered as one-tap
 * fill-ins for a new event, so a shift pattern needs typing only the first time.
 */
export function recentSlots(
  events: readonly Pick<
    CalendarEvent & { createdAt?: number },
    'title' | 'kind' | 'startTime' | 'endTime' | 'createdAt'
  >[],
  limit = 4,
): Slot[] {
  const seen = new Set<string>();
  const out: Slot[] = [];
  const newestFirst = [...events].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  for (const e of newestFirst) {
    if (e.kind === 'reminder' || !e.startTime || !e.endTime || !e.title.trim()) continue;
    const key = `${e.title}|${e.startTime}|${e.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: e.title, startTime: e.startTime, endTime: e.endTime });
    if (out.length === limit) break;
  }
  return out;
}
