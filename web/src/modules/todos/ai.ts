import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Aufgaben in Listen mit Priorität (0-3), Fälligkeit und Unteraufgaben (parentId)',
  collections: {
    task: {
      label: 'Aufgabe',
      fields: { title: 'text', done: 'bool', priority: 'num', dueDate: 'date', note: 'text' },
      dateField: 'dueDate',
      titleField: 'title',
      searchable: ['title', 'note'],
    },
    list: {
      label: 'Liste',
      fields: { name: 'text' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
};
