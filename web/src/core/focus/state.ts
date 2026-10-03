/**
 * Device-local state of the focus aids in `_meta` (never synced, never in a backup): the running
 * focus session and the suggestions skipped today. A session survives reloads and app restarts.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db/db';
import { today } from '@/core/time/now';
import { focusSessionSchema, type FocusSession } from './session';

export const FOCUS_SESSION_KEY = 'focus.session';
export const FOCUS_SKIPPED_KEY = 'focus.skipped';

const meta = () => db.table<{ key: string; value: unknown }, string>('_meta');

export async function getFocusSession(): Promise<FocusSession | undefined> {
  const row = await meta().get(FOCUS_SESSION_KEY);
  const parsed = focusSessionSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : undefined;
}

export async function saveFocusSession(session: FocusSession): Promise<void> {
  await meta().put({ key: FOCUS_SESSION_KEY, value: session });
}

export async function clearFocusSession(): Promise<void> {
  await meta().delete(FOCUS_SESSION_KEY);
}

/** Live session; `null` = none, `undefined` while loading. */
export const useFocusSession = (): FocusSession | null | undefined =>
  useLiveQuery(async () => (await getFocusSession()) ?? null, []);

interface Skipped {
  day: string;
  ids: string[];
}

async function readSkipped(day: string): Promise<string[]> {
  const value = (await meta().get(FOCUS_SKIPPED_KEY))?.value as Skipped | undefined;
  return value && value.day === day && Array.isArray(value.ids) ? value.ids : [];
}

/** "Etwas anderes": the task is not suggested again today. */
export async function skipSuggestion(id: string, day: string = today()): Promise<void> {
  const ids = await readSkipped(day);
  if (!ids.includes(id))
    await meta().put({ key: FOCUS_SKIPPED_KEY, value: { day, ids: [...ids, id] } });
}

export async function resetSkipped(): Promise<void> {
  await meta().delete(FOCUS_SKIPPED_KEY);
}

/** Live list of the ids skipped today. */
export const useSkippedToday = (day: string): string[] | undefined =>
  useLiveQuery(() => readSkipped(day), [day]);
