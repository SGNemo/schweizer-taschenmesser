import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Einkaufsliste: Artikel mit Menge; done = schon gekauft',
  collections: {
    item: {
      label: 'Einkaufsartikel',
      fields: { name: 'text', quantity: 'text', done: 'bool' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
};
