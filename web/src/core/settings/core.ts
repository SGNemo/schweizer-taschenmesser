/** App-wide preferences (synced scope `core`): display name and first day of the week. */
import { z } from 'zod';
import { useSettings } from './settings';

export const CORE_SCOPE = 'core';

export const coreSettingsSchema = z.object({
  /** Optional name for greetings; empty = none. */
  displayName: z.string().max(60),
  /** First weekday of calendar weeks: Monday (ISO 1) or Sunday (7). */
  weekStart: z.enum(['mon', 'sun']),
});
export type CoreSettings = z.infer<typeof coreSettingsSchema>;
export const DEFAULT_CORE: CoreSettings = { displayName: '', weekStart: 'mon' };

/** ISO weekday number of the first day of the week. */
export type WeekStart = 1 | 7;

export function useWeekStart(): WeekStart {
  const [values] = useSettings(CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE);
  return values?.weekStart === 'sun' ? 7 : 1;
}
