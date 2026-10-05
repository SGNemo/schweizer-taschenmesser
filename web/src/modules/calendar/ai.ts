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
  actions: {
    create: {
      kind: 'create',
      collection: 'event',
      label: 'Termin anlegen',
      description: 'Termin oder Erinnerung (kind=reminder) mit Datum, Uhrzeit, Ort, Wiederholung',
      fields: ['title', 'kind', 'startDate', 'startTime', 'location', 'recurrence', 'note'],
      required: ['title', 'startDate'],
      parse: {
        keywords: ['termin', 'meeting', 'erinnerung', 'erinnere', 'verabredung'],
        fallback: 'dateTime',
        values: { kind: { reminder: ['erinnerung', 'erinnere'] } },
        defaults: { startDate: '@today' },
      },
      examples: [
        {
          input: 'Termin Zahnarzt am 2.10. um 14:30',
          output: { title: 'Zahnarzt', startDate: '2026-10-02', startTime: '14:30' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'event',
      label: 'Termin ändern',
      description: 'Titel, Datum, Uhrzeit oder Ort eines Termins ändern',
      fields: ['title', 'startDate', 'startTime', 'location', 'note'],
      examples: [
        {
          input: 'Verschiebe den Termin Zahnarzt auf 5.10. 9 Uhr',
          target: 'Zahnarzt',
          output: { startDate: '2026-10-05', startTime: '09:00' },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'event',
      label: 'Termin löschen',
      description: 'Termin oder Erinnerung löschen',
      examples: [{ input: 'Lösche den Termin Zahnarzt', target: 'Zahnarzt', output: {} }],
    },
  },
};
