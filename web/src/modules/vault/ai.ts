import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Unterlagen (Ausweis, Versicherung, Vertrag, Garantie …) mit Ende/Ablauf und Kündigungsfrist; Dateien sind nicht abfragbar',
  collections: {
    document: {
      label: 'Unterlage',
      fields: {
        title: 'text',
        category: 'enum:identity|insurance|contract|warranty|tax|health|other',
        provider: 'text',
        startDate: 'date',
        endDate: 'date',
        noticeDays: 'num',
        note: 'text',
      },
      dateField: 'endDate',
      titleField: 'title',
      searchable: ['title', 'provider', 'note', 'fileName'],
    },
  },
};
