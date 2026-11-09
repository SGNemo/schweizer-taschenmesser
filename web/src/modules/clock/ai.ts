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
      // Never plain „uhr“: create keywords match by word prefix, and „um 14 Uhr“ is a calendar time.
      parse: { keywords: ['weltuhr', 'zeitzone'] },
      examples: [{ input: 'Füge Tokio zur Weltuhr hinzu', output: { label: 'Tokio' } }],
    },
  },
};
