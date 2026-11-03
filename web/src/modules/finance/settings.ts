import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';
import { t } from '@/strings';

export const settingsSchema = z.object({
  includeOpenInvoices: z.boolean(),
  includeSubscriptions: z.boolean(),
  forecastHorizon: z.enum(['month', '30', '90']),
});

export const settings: ModuleSettings = {
  schema: settingsSchema,
  defaults: { includeOpenInvoices: true, includeSubscriptions: true, forecastHorizon: 'month' },
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
    {
      key: 'forecastHorizon',
      get label() {
        return t.finance.ext.settings.forecastHorizon;
      },
      type: 'select',
      get options() {
        return [
          { value: 'month', label: t.finance.ext.settings.month },
          { value: '30', label: t.finance.ext.settings.d30 },
          { value: '90', label: t.finance.ext.settings.d90 },
        ];
      },
    },
  ],
};
