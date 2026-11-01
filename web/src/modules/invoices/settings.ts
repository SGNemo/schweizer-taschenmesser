import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  remindDaysBefore: z.number().int().min(0).max(60),
  remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** A paid invoice becomes an expense in Finances (the behaviour since the module exists). */
  bookWhenPaid: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { remindDaysBefore: 2, remindTime: '09:00', bookWhenPaid: true },
  fields: [
    {
      key: 'remindDaysBefore',
      get label() {
        return t.invoices.meta.settings.remindDaysBefore;
      },
      type: 'number',
      get help() {
        return t.invoices.meta.settings.remindDaysBeforeHelp;
      },
    },
    {
      key: 'remindTime',
      get label() {
        return t.invoices.meta.settings.remindTime;
      },
      type: 'text',
      get help() {
        return t.invoices.meta.settings.remindTimeHelp;
      },
    },
    {
      key: 'bookWhenPaid',
      get label() {
        return t.invoices.meta.settings.bookWhenPaid;
      },
      type: 'boolean',
      get help() {
        return t.invoices.meta.settings.bookWhenPaidHelp;
      },
    },
  ],
};
