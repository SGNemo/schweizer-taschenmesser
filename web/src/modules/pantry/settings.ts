import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  soonDays: z.number().int().min(0).max(60),
  remindDaysBefore: z.number().int().min(0).max(30),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { soonDays: 3, remindDaysBefore: 1, remindTime: '18:00' },
  fields: [
    { key: 'soonDays', label: t.pantry.meta.settings.soonDays, type: 'number' },
    { key: 'remindDaysBefore', label: t.pantry.meta.settings.remindDaysBefore, type: 'number' },
    {
      key: 'remindTime',
      label: t.pantry.meta.settings.remindTime,
      type: 'text',
      help: t.pantry.meta.settings.remindTimeHelp,
    },
  ],
};
