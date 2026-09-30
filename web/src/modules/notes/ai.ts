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
};
