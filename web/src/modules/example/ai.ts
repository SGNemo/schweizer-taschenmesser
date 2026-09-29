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
};
