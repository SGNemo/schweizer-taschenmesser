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
      label: t.finance.meta.settings.includeOpenInvoices,
      type: 'boolean',
    },
    {
      key: 'includeSubscriptions',
      label: t.finance.meta.settings.includeSubscriptions,
      type: 'boolean',
      help: t.finance.meta.settings.includeSubscriptionsHelp,
    },
  ],
};
