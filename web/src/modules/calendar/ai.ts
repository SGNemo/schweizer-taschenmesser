import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Termine mit Datum, Uhrzeit, Ort; auch mehrtägig oder wiederkehrend',
  collections: {
    event: {
      label: 'Termin',
      fields: {
        title: 'text',
        startDate: 'date',
        startTime: 'text',
        location: 'text',
        recurrence: 'recurrence',
        note: 'text',
      },
      dateField: 'startDate',
      titleField: 'title',
      searchable: ['title', 'location', 'note'],
    },
  },
};
