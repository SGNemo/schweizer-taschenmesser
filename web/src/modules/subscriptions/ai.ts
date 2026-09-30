import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Abos und wiederkehrende Zahlungen mit Betrag (Cent), Intervall und Kündigungsfrist in Tagen',
  computed: { costs: 'Kosten aller aktiven Abos pro Monat und pro Jahr' },
  collections: {
    subscription: {
      label: 'Abo',
      fields: {
        name: 'text',
        amountMinor: 'money',
        startDate: 'date',
        recurrence: 'recurrence',
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
