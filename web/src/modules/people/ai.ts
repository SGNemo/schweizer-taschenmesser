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
};
