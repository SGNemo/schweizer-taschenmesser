import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Notizen mit Titel und Text; angeheftete zuerst',
  collections: {
    note: {
      label: 'Notiz',
      fields: { title: 'text', body: 'text', pinned: 'bool' },
      titleField: 'title',
      searchable: ['title', 'body'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'note',
      label: 'Notiz anlegen',
      description: 'Neue Notiz mit Titel und Text',
      fields: ['title', 'body', 'pinned'],
      required: ['title'],
      parse: { keywords: ['notiz', 'notizen'] },
      examples: [
        {
          input: 'Notiz Idee für den Garten',
          output: { title: 'Idee für den Garten' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'note',
      label: 'Notiz ändern',
      description: 'Titel einer Notiz ändern',
      fields: ['title', 'body', 'pinned'],
      examples: [
        {
          input: 'Benenne die Notiz Idee für den Garten in Gartenplan um',
          target: 'Idee für den Garten',
          output: { title: 'Gartenplan' },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'note',
      label: 'Notiz löschen',
      description: 'Notiz löschen',
      examples: [
        {
          input: 'Lösche die Notiz Idee für den Garten',
          target: 'Idee für den Garten',
          output: {},
        },
      ],
    },
  },
};
