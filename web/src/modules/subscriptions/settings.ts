import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  cancelRemindDaysBefore: z.number().int().min(0).max(60),
  /** Days before a trial ends that a reminder comes (0 = on the last day). */
  trialRemindDaysBefore: z.number().int().min(0).max(30),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** One notice under "Jetzt wichtig" when a price went up. */
  priceHint: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: {
    cancelRemindDaysBefore: 3,
    trialRemindDaysBefore: 3,
    remindTime: '09:00',
    priceHint: true,
  },
  fields: [
    {
      key: 'cancelRemindDaysBefore',
      get label() {
        return t.subscriptions.meta.settings.cancelRemindDaysBefore;
      },
      type: 'number',
      get help() {
        return t.subscriptions.meta.settings.cancelRemindDaysBeforeHelp;
      },
    },
    {
      key: 'trialRemindDaysBefore',
      get label() {
        return t.subscriptions.ext.trial.remindDaysBefore;
      },
      type: 'number',
      get help() {
        return t.subscriptions.ext.trial.remindDaysBeforeHelp;
      },
    },
    {
      key: 'remindTime',
      get label() {
        return t.subscriptions.meta.settings.remindTime;
      },
      type: 'text',
      get help() {
        return t.subscriptions.meta.settings.remindTimeHelp;
      },
    },
    {
      key: 'priceHint',
      get label() {
        return t.subscriptions.meta.settings.priceHint;
      },
      type: 'boolean',
      get help() {
        return t.subscriptions.meta.settings.priceHintHelp;
      },
    },
  ],
};
