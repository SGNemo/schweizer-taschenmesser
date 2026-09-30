import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Dokumente (Ausweis, Versicherung, Steuer …) mit Ablaufdatum; Dateien sind nicht abfragbar',
  collections: {
    document: {
      label: 'Dokument',
      fields: {
        title: 'text',
        category: 'enum:identity|insurance|contract|tax|health|other',
        note: 'text',
        expiresOn: 'date',
      },
      dateField: 'expiresOn',
      titleField: 'title',
      searchable: ['title', 'note', 'fileName'],
    },
  },
};
