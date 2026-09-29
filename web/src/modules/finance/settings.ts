import { z } from 'zod';
import type { ModuleSettings } from '@/core/modules/types';

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
      label: 'Offene Rechnungen vom verfügbaren Betrag abziehen',
      type: 'boolean',
    },
    {
      key: 'includeSubscriptions',
      label: 'Abo-Abbuchungen bis Monatsende abziehen',
      type: 'boolean',
      help: 'Abos werden nicht automatisch gebucht',
    },
  ],
};
