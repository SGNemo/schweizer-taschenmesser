import { z } from 'zod';
import { TRASH_GRACE_MS, TRASH_RETENTION_MS } from '@/core/db/trash';
import { getSettings, setSettings, useSettings } from '@/core/settings/settings';

export const TRASH_SCOPE = 'trash';

/** "Zuletzt gelöscht aufbewahren": on by default (it keeps data longer, so it has an off switch). */
export const trashSettingsSchema = z.object({ keep: z.boolean() });
export const DEFAULT_TRASH = { keep: true };

export const useTrashSettings = () => {
  const [values, patch] = useSettings(TRASH_SCOPE, trashSettingsSchema, DEFAULT_TRASH);
  return [values ?? DEFAULT_TRASH, patch] as const;
};

export const getTrashSettings = () => getSettings(TRASH_SCOPE, trashSettingsSchema, DEFAULT_TRASH);

export const setTrashKeep = (keep: boolean): Promise<void> => setSettings(TRASH_SCOPE, { keep });

/** How long a deleted record (and the files next to it) stays restorable right now. */
export async function trashRetentionMs(): Promise<number> {
  return (await getTrashSettings()).keep ? TRASH_RETENTION_MS : TRASH_GRACE_MS;
}
