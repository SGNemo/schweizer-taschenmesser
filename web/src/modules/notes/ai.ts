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
      description:
        'Titel einer Notiz ändern, sie anheften oder Text unten anhängen (der bestehende Text bleibt)',
      fields: ['title', 'body', 'pinned'],
      // Text for a note is only ever added after the stored one, never replaced.
      append: ['body'],
      parse: { keywords: ['notiz'], roles: { note: 'body' } },
      examples: [
        {
          input: 'Benenne die Notiz Idee für den Garten in Gartenplan um',
          target: 'Idee für den Garten',
          output: { title: 'Gartenplan' },
        },
        {
          input: 'Ergänze die Notiz Idee für den Garten um Tomaten und Gurken',
          target: 'Idee für den Garten',
          output: { body: 'Tomaten und Gurken' },
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
