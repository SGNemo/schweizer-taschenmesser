import type { ModuleAiSchema } from '@/core/modules/types';

/** `person` only: gifts are a surprise, the assistant gets no schema for them. */
export const aiSchema: ModuleAiSchema = {
  description:
    'Personen mit Name, Geburtstag (Tag, Monat, optional Jahr; jährlich wiederkehrend) und Tags',
  collections: {
    person: {
      label: 'Person',
      fields: { name: 'text', note: 'text' },
      titleField: 'name',
      searchable: ['name', 'note'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'person',
      label: 'Person anlegen',
      description: 'Neue Person mit Namen und Notiz',
      fields: ['name', 'note'],
      required: ['name'],
      parse: { keywords: ['person', 'kontakt'] },
      examples: [{ input: 'Person Anna Muster', output: { name: 'Anna Muster' } }],
    },
    update: {
      kind: 'update',
      collection: 'person',
      label: 'Person ändern',
      description: 'Name oder Notiz einer Person ändern',
      fields: ['name', 'note'],
      examples: [
        {
          input: 'Benenne die Person Anna Muster in Anna Musterfrau um',
          target: 'Anna Muster',
          output: { name: 'Anna Musterfrau' },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'person',
      label: 'Person löschen',
      description: 'Person löschen',
      examples: [{ input: 'Lösche die Person Anna Muster', target: 'Anna Muster', output: {} }],
    },
  },
};
