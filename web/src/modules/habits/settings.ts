import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  /** Off = no reminders at all (the rings and the history stay). */
  remindersEnabled: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { remindersEnabled: true },
  keywords: ['Trinkerinnerung', 'Wassertimer', 'Durst', 'Pausentage', 'Heatmap'],
  fields: [
    {
      key: 'remindersEnabled',
      get label() {
        return t.habits.meta.settings.remindersEnabled;
      },
      type: 'boolean',
      get help() {
        return t.habits.meta.settings.remindersHelp;
      },
    },
  ],
};
