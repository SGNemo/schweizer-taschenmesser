/**
 * Focus and attention aids (synced scope `focus`): one switch per aid, sensible defaults, nothing
 * forced. Device-local state of the aids (running focus timer, skipped suggestions) is not here but
 * in `_meta` (see `core/focus/state.ts`). Rules: docs/design/FOCUS-GUIDELINES.md.
 */
import { z } from 'zod';
import { getSettings, setSettings, useSettings } from './settings';

export const FOCUS_SCOPE = 'focus';

export const PLAN_LIMITS = [2, 3, 4, 5] as const;
export const FOCUS_MINUTES = [15, 25, 45, 60] as const;

export const focusSettingsSchema = z.object({
  /** "Jetzt dran": one suggested next task on the home screen. */
  nextOne: z.boolean(),
  /** The day plan ("Heute") with a done-today line. */
  dayPlan: z.boolean(),
  /** How many things the day plan shows. */
  planLimit: z.number().int().min(1).max(5),
  /** "Jetzt wichtig" collapsed to one calm chip; overdue ToDos without a day counter. */
  calmAttention: z.boolean(),
  /** Time until the next appointment and the day progress. */
  timeToNext: z.boolean(),
  /** Default length of the focus timer in minutes. */
  focusMinutes: z.number().int().min(5).max(120),
  /** Soft beep when the focus time is up (the toast always appears). */
  focusSound: z.boolean(),
  /** Small indicator in the top bar while a focus session runs. */
  focusIndicator: z.boolean(),
});
export type FocusSettings = z.infer<typeof focusSettingsSchema>;

export const DEFAULT_FOCUS: FocusSettings = {
  nextOne: true,
  dayPlan: true,
  planLimit: 3,
  calmAttention: true,
  timeToNext: true,
  focusMinutes: 25,
  focusSound: false,
  focusIndicator: true,
};

/** Live settings; the defaults while loading, so a widget never waits on them. */
export function useFocusSettings(): readonly [
  FocusSettings,
  (patch: Partial<FocusSettings>) => Promise<void>,
] {
  const [values, patch] = useSettings(FOCUS_SCOPE, focusSettingsSchema, DEFAULT_FOCUS);
  return [values ?? DEFAULT_FOCUS, patch] as const;
}

export const getFocusSettings = (): Promise<FocusSettings> =>
  getSettings(FOCUS_SCOPE, focusSettingsSchema, DEFAULT_FOCUS);

export const patchFocusSettings = (patch: Partial<FocusSettings>): Promise<void> =>
  setSettings(FOCUS_SCOPE, patch);
