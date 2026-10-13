import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const settingsSchema = z.object({
  defaultView: z.enum(['month', 'week', 'day']),
  /** Time of day a new reminder starts with. */
  defaultReminderTime: z.string().regex(TIME),
  /** Time of day all-day events notify at. */
  allDayNotifyTime: z.string().regex(TIME),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { defaultView: 'month', defaultReminderTime: '09:00', allDayNotifyTime: '09:00' },
  fields: [
    {
      key: 'defaultView',
      get label() {
        return t.calendar.meta.settings.defaultView;
      },
      type: 'select',
      options: [
        {
          value: 'month',
          get label() {
            return t.calendar.meta.settings.defaultView_month;
          },
        },
        {
          value: 'week',
          get label() {
            return t.calendar.meta.settings.defaultView_week;
          },
        },
        {
          value: 'day',
          get label() {
            return t.calendar.meta.settings.defaultView_day;
          },
        },
      ],
    },
    {
      key: 'defaultReminderTime',
      get label() {
        return t.calendar.meta.settings.defaultReminderTime;
      },
      type: 'text',
      get help() {
        return t.calendar.meta.settings.timeHelp;
      },
    },
    {
      key: 'allDayNotifyTime',
      get label() {
        return t.calendar.meta.settings.allDayNotifyTime;
      },
      type: 'text',
      get help() {
        return t.calendar.meta.settings.timeHelp;
      },
    },
  ],
};
