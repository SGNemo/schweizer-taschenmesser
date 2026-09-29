import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Verträge, Versicherungen und Garantien mit Ablaufdatum und Kündigungsfrist in Tagen vor Ablauf',
  collections: {
    contract: {
      label: 'Vertrag',
      fields: {
        name: 'text',
        kind: 'enum:contract|insurance|warranty',
        provider: 'text',
        startDate: 'date',
        endDate: 'date',
        noticeDays: 'num',
        note: 'text',
      },
      dateField: 'endDate',
      titleField: 'name',
      searchable: ['name', 'provider', 'note'],
    },
  },
};
