import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Aufgaben in Listen mit Priorität (0-3), Fälligkeit, Wiederholung, „Irgendwann“ (someday) und Unteraufgaben (parentId)',
  collections: {
    task: {
      label: 'Aufgabe',
      fields: {
        title: 'text',
        done: 'bool',
        priority: 'num',
        dueDate: 'date',
        recurrence: 'recurrence',
        someday: 'bool',
        note: 'text',
      },
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
  actions: {
    create: {
      kind: 'create',
      collection: 'task',
      label: 'Aufgabe anlegen',
      description: 'Neue Aufgabe, optional mit Fälligkeit, Priorität (0-3) oder Wiederholung',
      fields: ['title', 'dueDate', 'priority', 'recurrence', 'someday', 'note'],
      required: ['title'],
      parse: { keywords: ['aufgabe', 'todo', 'to-do', 'task'], roles: { note: 'note' } },
      examples: [
        {
          input: 'Aufgabe Steuererklärung abgeben bis 15.10.',
          output: { title: 'Steuererklärung abgeben', dueDate: '2026-10-15' },
        },
      ],
    },
    complete: {
      kind: 'transition',
      collection: 'task',
      label: 'Aufgabe erledigen',
      description: 'Aufgabe als erledigt abhaken',
      set: { done: true },
      parse: { keywords: ['erledigt', 'erledige', 'fertig', 'abgehakt', 'abhaken'] },
      examples: [
        {
          input: 'Aufgabe Steuererklärung abgeben erledigt',
          target: 'Steuererklärung abgeben',
          output: { done: true },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'task',
      label: 'Aufgabe ändern',
      description: 'Titel, Fälligkeit, Priorität oder Notiz einer Aufgabe ändern',
      fields: ['title', 'dueDate', 'priority', 'note', 'recurrence'],
      examples: [
        {
          input: 'Verschiebe die Aufgabe Steuererklärung abgeben auf 20.10.',
          target: 'Steuererklärung abgeben',
          output: { dueDate: '2026-10-20' },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'task',
      label: 'Aufgabe löschen',
      description: 'Aufgabe löschen',
      examples: [
        {
          input: 'Lösche die Aufgabe Steuererklärung abgeben',
          target: 'Steuererklärung abgeben',
          output: {},
        },
      ],
    },
  },
};
