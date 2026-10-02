import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  remindDaysBefore: z.number().int().min(0).max(60),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { remindDaysBefore: 2, remindTime: '09:00' },
  fields: [
    {
      key: 'remindDaysBefore',
      label: t.invoices.meta.settings.remindDaysBefore,
      type: 'number',
      help: t.invoices.meta.settings.remindDaysBeforeHelp,
    },
    {
      key: 'remindTime',
      label: t.invoices.meta.settings.remindTime,
      type: 'text',
      help: t.invoices.meta.settings.remindTimeHelp,
    },
  ],
};
