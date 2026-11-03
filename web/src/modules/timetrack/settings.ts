import { t } from '@/strings';
import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

export const settingsSchema = z.object({
  /** Minutes without input after which a running timer asks; 0 = never ask. */
  idleMinutes: z.number().int().min(0).max(240),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { idleMinutes: 15 },
  keywords: ['Stempeluhr', 'Stundenzettel', 'Stundensatz', 'Abwesenheitsfrage'],
  fields: [
    {
      key: 'idleMinutes',
      get label() {
        return t.timetrack.meta.settings.idleMinutes;
      },
      type: 'number',
      get help() {
        return t.timetrack.meta.settings.idleHelp;
      },
    },
  ],
};
