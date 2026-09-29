import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Rechnungen mit Empfänger, Betrag (Cent), Fälligkeit und Status open/paid',
  collections: {
    invoice: {
      label: 'Rechnung',
      fields: {
        payee: 'text',
        amountMinor: 'money',
        dueDate: 'date',
        status: 'enum:open|paid',
        paidAt: 'date',
        note: 'text',
      },
      dateField: 'dueDate',
      titleField: 'payee',
      searchable: ['payee', 'note'],
    },
  },
};
