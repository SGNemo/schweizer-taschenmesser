import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description sent to the LLM (stage 2). Keep it tiny; it never contains user data. */
export const aiSchema: ModuleAiSchema = {
  description: 'Beispiel entries',
  collections: {
    entry: {
      label: 'Eintrag',
      fields: { title: 'text', done: 'bool', note: 'text' },
      titleField: 'title',
      searchable: ['title', 'note'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'entry',
      label: 'Eintrag anlegen',
      description: 'Beispieleintrag mit Titel',
      fields: ['title', 'note'],
      required: ['title'],
      parse: { keywords: ['eintrag'] },
      examples: [{ input: 'Lege den Eintrag Testeintrag an', output: { title: 'Testeintrag' } }],
    },
    delete: {
      kind: 'delete',
      collection: 'entry',
      label: 'Eintrag löschen',
      description: 'Beispieleintrag löschen',
      examples: [{ input: 'Lösche den Eintrag Testeintrag', target: 'Testeintrag', output: {} }],
    },
  },
};
