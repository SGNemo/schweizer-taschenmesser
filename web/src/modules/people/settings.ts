import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  remindDaysBefore: z.number().int().min(0).max(30),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** Gifts with a day become „Geschenk für <Name>“ in the planner (only with the planner on). */
  showInPlan: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { remindDaysBefore: 0, remindTime: '09:00', showInPlan: true },
  fields: [
    {
      key: 'remindDaysBefore',
      get label() {
        return t.people.meta.settings.remindDaysBefore;
      },
      type: 'number',
      get help() {
        return t.people.meta.settings.remindDaysBeforeHelp;
      },
    },
    {
      key: 'remindTime',
      get label() {
        return t.people.meta.settings.remindTime;
      },
      type: 'text',
      get help() {
        return t.people.meta.settings.remindTimeHelp;
      },
    },
    {
      key: 'showInPlan',
      get label() {
        return t.people.meta.settings.showInPlan;
      },
      type: 'boolean',
      get help() {
        return t.people.meta.settings.showInPlanHelp;
      },
    },
  ],
};
