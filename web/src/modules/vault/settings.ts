import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  remindDaysBefore: z.number().int().min(0).max(365),
  remindDaysBeforeDeadline: z.number().int().min(0).max(365),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** Deadlines and expiry dates appear in the planner (`plannable.ts`); only read while the planner is on. */
  showInPlan: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: {
    remindDaysBefore: 30,
    remindDaysBeforeDeadline: 14,
    remindTime: '09:00',
    showInPlan: true,
  },
  fields: [
    {
      key: 'remindDaysBefore',
      get label() {
        return t.vault.meta.settings.remindDaysBefore;
      },
      type: 'number',
    },
    {
      key: 'remindDaysBeforeDeadline',
      get label() {
        return t.vault.meta.settings.remindDaysBeforeDeadline;
      },
      type: 'number',
    },
    {
      key: 'remindTime',
      get label() {
        return t.vault.meta.settings.remindTime;
      },
      type: 'text',
      get help() {
        return t.vault.meta.settings.remindTimeHelp;
      },
    },
    {
      key: 'showInPlan',
      get label() {
        return t.vault.meta.settings.showInPlan;
      },
      type: 'boolean',
      get help() {
        return t.vault.meta.settings.showInPlanHelp;
      },
    },
  ],
};
