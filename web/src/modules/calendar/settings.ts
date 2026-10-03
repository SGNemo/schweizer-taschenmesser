import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { TIME_RE } from '@/core/time/dates';
import { t } from '@/strings';

export const settingsSchema = z.object({
  defaultView: z.enum(['month', 'week', 'day']),
  /** Time of day a new reminder starts with. */
  defaultReminderTime: z.string().regex(TIME_RE),
  /** Time of day all-day events notify at. */
  allDayNotifyTime: z.string().regex(TIME_RE),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { defaultView: 'month', defaultReminderTime: '09:00', allDayNotifyTime: '09:00' },
  fields: [
    {
      key: 'defaultView',
      label: t.calendar.meta.settings.defaultView,
      type: 'select',
      options: [
        { value: 'month', label: t.calendar.meta.settings.defaultView_month },
        { value: 'week', label: t.calendar.meta.settings.defaultView_week },
        { value: 'day', label: t.calendar.meta.settings.defaultView_day },
      ],
    },
    {
      key: 'defaultReminderTime',
      label: t.calendar.meta.settings.defaultReminderTime,
      type: 'text',
      help: t.calendar.meta.settings.timeHelp,
    },
    {
      key: 'allDayNotifyTime',
      label: t.calendar.meta.settings.allDayNotifyTime,
      type: 'text',
      help: t.calendar.meta.settings.timeHelp,
    },
  ],
};
