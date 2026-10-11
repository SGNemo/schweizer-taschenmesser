import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  includeOpenInvoices: z.boolean(),
  includeSubscriptions: z.boolean(),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { includeOpenInvoices: true, includeSubscriptions: true },
  fields: [
    {
      key: 'includeOpenInvoices',
      get label() {
        return t.finance.meta.settings.includeOpenInvoices;
      },
      type: 'boolean',
    },
    {
      key: 'includeSubscriptions',
      get label() {
        return t.finance.meta.settings.includeSubscriptions;
      },
      type: 'boolean',
      get help() {
        return t.finance.meta.settings.includeSubscriptionsHelp;
      },
    },
  ],
};
