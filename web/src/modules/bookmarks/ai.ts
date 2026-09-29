import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Merkliste: Links, Lesen, Ansehen, Orte, Ideen mit Tags und Erledigt-Status',
  collections: {
    item: {
      label: 'Merkzettel',
      fields: {
        title: 'text',
        url: 'text',
        kind: 'enum:link|read|watch|place|idea|other',
        tags: 'tags',
        note: 'text',
        done: 'bool',
      },
      titleField: 'title',
      searchable: ['title', 'url', 'note', 'tags'],
    },
  },
};
