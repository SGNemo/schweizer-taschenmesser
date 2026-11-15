import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

/** `widgetList`: id of the list the widget shows ('' = the first shopping list in use). Set from the list's "⋯" menu. */
export const settingsSchema = z.object({ widgetList: z.string().max(80).default('') });
export const SETTINGS_SCOPE = 'module.lists';

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { widgetList: '' },
  fields: [],
};
