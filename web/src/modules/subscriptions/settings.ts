import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  cancelRemindDaysBefore: z.number().int().min(0).max(60),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { cancelRemindDaysBefore: 3, remindTime: '09:00' },
  fields: [
    {
      key: 'cancelRemindDaysBefore',
      label: t.subscriptions.meta.settings.cancelRemindDaysBefore,
      type: 'number',
      help: t.subscriptions.meta.settings.cancelRemindDaysBeforeHelp,
    },
    {
      key: 'remindTime',
      label: t.subscriptions.meta.settings.remindTime,
      type: 'text',
      help: t.subscriptions.meta.settings.remindTimeHelp,
    },
  ],
};
