import type { ModuleAiSchema } from '@/core/modules/types';

/**
 * Compact description for the assistant; never user data. One action: add a place (`label` = city or own name; `zone`
 * optional, `aiDefaults.ts` finds it offline from the name). No update or delete: renaming and removing stay on the page.
 */
export const aiSchema: ModuleAiSchema = {
  description: 'Orte, deren Uhrzeit angezeigt wird (Weltuhr)',
  collections: {
    place: {
      label: 'Ort',
      fields: { label: 'text', zone: 'text' },
      titleField: 'label',
      searchable: ['label'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'place',
      label: 'Ort hinzufügen',
      description: 'Ort zur Uhr hinzufügen; zone = IANA-Zeitzone (z. B. Asia/Tokyo)',
      fields: ['label', 'zone'],
      required: ['label'],
      parse: { keywords: ['weltuhr', 'uhr'] },
      examples: [{ input: 'Füge Tokio zur Weltuhr hinzu', output: { label: 'Tokio' } }],
    },
  },
};
