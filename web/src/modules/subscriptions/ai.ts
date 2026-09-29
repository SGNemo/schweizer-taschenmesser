import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Abos und wiederkehrende Zahlungen mit Betrag (Cent), Intervall und Kündigungsfrist in Tagen',
  collections: {
    subscription: {
      label: 'Abo',
      fields: {
        name: 'text',
        amountMinor: 'money',
        startDate: 'date',
        cancelNoticeDays: 'num',
        active: 'bool',
        note: 'text',
      },
      dateField: 'startDate',
      titleField: 'name',
      searchable: ['name', 'note'],
    },
  },
};
