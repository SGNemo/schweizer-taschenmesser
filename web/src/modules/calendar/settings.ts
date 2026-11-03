import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';
import { HOLIDAY_REGIONS } from './holidays';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const settingsSchema = z.object({
  defaultView: z.enum(['month', 'week', 'day', 'agenda', 'year']),
  /** Public holidays shown in the grids; off by default (computed offline, see holidays.ts). */
  holidayRegion: z.enum(HOLIDAY_REGIONS),
  /** Time of day a new reminder starts with. */
  defaultReminderTime: z.string().regex(TIME),
  /** Time of day all-day events notify at. */
  allDayNotifyTime: z.string().regex(TIME),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: {
    defaultView: 'month',
    holidayRegion: 'off',
    defaultReminderTime: '09:00',
    allDayNotifyTime: '09:00',
  },
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
        {
          value: 'agenda',
          get label() {
            return t.calendar.agenda;
          },
        },
        {
          value: 'year',
          get label() {
            return t.calendar.year;
          },
        },
      ],
    },
    {
      key: 'holidayRegion',
      get label() {
        return t.calendar.meta.settings.holidayRegion;
      },
      type: 'select',
      options: HOLIDAY_REGIONS.map((value) => ({
        value,
        get label() {
          return t.calendar.holidayRegions[value];
        },
      })),
      get help() {
        return t.calendar.meta.settings.holidayHelp;
      },
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
