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
  actions: {
    create: {
      kind: 'create',
      collection: 'item',
      label: 'Eintrag hinzufügen',
      description: 'Eintrag auf die Einkaufsliste (mehrere mit Komma)',
      fields: ['name', 'quantity'],
      required: ['name'],
      parse: {
        keywords: ['einkaufsliste', 'einkaufszettel', 'einkauf'],
        splitItems: true,
      },
      examples: [{ input: 'Milch auf die Einkaufsliste', output: { name: 'Milch' } }],
    },
    check: {
      kind: 'transition',
      collection: 'item',
      label: 'Eintrag abhaken',
      description: 'Eintrag als erledigt/gekauft abhaken',
      set: { done: true },
      parse: { keywords: ['gekauft', 'abgehakt', 'abhaken', 'hake'] },
      examples: [{ input: 'Milch ist gekauft', target: 'Milch', output: { done: true } }],
    },
    delete: {
      kind: 'delete',
      collection: 'item',
      label: 'Eintrag löschen',
      description: 'Eintrag von der Liste entfernen',
      examples: [{ input: 'Streiche Milch von der Einkaufsliste', target: 'Milch', output: {} }],
    },
  },
};
