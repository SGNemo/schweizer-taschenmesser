import { z } from 'zod';
import { TRASH_GRACE_MS } from '@/core/db/trash';
import { getSettings, setSettings, useSettings } from '@/core/settings/settings';

export const TRASH_SCOPE = 'trash';

/** Days a deleted record stays restorable while "aufbewahren" is on (at most the sync tombstone time, 90 days). */
export const TRASH_KEEP_DAYS = ['7', '30', '90'] as const;
export type TrashKeepDays = (typeof TRASH_KEEP_DAYS)[number];

/** "Zuletzt gelöscht aufbewahren": on by default (it keeps data longer, so it has an off switch), 30 days. */
export const trashSettingsSchema = z.object({ keep: z.boolean(), days: z.enum(TRASH_KEEP_DAYS) });
export const DEFAULT_TRASH: z.output<typeof trashSettingsSchema> = { keep: true, days: '30' };

export const useTrashSettings = () => {
  const [values, patch] = useSettings(TRASH_SCOPE, trashSettingsSchema, DEFAULT_TRASH);
  return [values ?? DEFAULT_TRASH, patch] as const;
};

export const getTrashSettings = () => getSettings(TRASH_SCOPE, trashSettingsSchema, DEFAULT_TRASH);

export const setTrashKeep = (keep: boolean): Promise<void> =>
  setSettings(TRASH_SCOPE, { keep }, DEFAULT_TRASH);

const DAY_MS = 24 * 3600_000;

/** The window for a number of keep days. */
export const keepWindowMs = (days: TrashKeepDays): number => Number(days) * DAY_MS;

/** How long a deleted record (and the files next to it) stays restorable right now. */
export async function trashRetentionMs(): Promise<number> {
  const { keep, days } = await getTrashSettings();
  return keep ? keepWindowMs(days) : TRASH_GRACE_MS;
}
