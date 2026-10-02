import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description sent to the LLM (stage 2). Keep it tiny; it never contains user data. */
export const aiSchema: ModuleAiSchema = {
  description: 'Listen: Einkaufsliste, Packlisten und Checklisten',
  collections: {
    list: {
      label: 'Liste',
      fields: { name: 'text', kind: 'enum:shopping|packing|checklist', note: 'text' },
      titleField: 'name',
      searchable: ['name', 'note'],
    },
    item: {
      label: 'Eintrag',
      fields: { name: 'text', quantity: 'text', done: 'bool' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
};
