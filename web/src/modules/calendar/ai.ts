import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Termine und Erinnerungen (kind=reminder) mit Datum, Uhrzeit, Ort; auch mehrtägig oder wiederkehrend',
  collections: {
    event: {
      label: 'Termin',
      fields: {
        title: 'text',
        kind: 'enum:event|reminder',
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
    external: {
      label: 'Externer Termin',
      fields: { title: 'text', startDate: 'date', startTime: 'text', location: 'text' },
      dateField: 'startDate',
      titleField: 'title',
      searchable: ['title', 'location'],
    },
  },
};
