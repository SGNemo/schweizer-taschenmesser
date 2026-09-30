import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Erinnerungen mit Startdatum, Uhrzeit und Wiederholung',
  collections: {
    reminder: {
      label: 'Erinnerung',
      fields: {
        title: 'text',
        startDate: 'date',
        time: 'text',
        active: 'bool',
        note: 'text',
        recurrence: 'recurrence',
      },
      dateField: 'startDate',
      titleField: 'title',
      searchable: ['title', 'note'],
    },
  },
};
