import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description for the assistant; contains no user data. */
export const aiSchema: ModuleAiSchema = {
  description: 'Vorräte mit Ablaufdatum (Kühlschrank, Vorratsschrank, Tiefkühler)',
  collections: {
    item: {
      label: 'Vorrat',
      fields: {
        name: 'text',
        place: 'enum:fridge|freezer|pantry|other',
        count: 'num',
        expires: 'date',
      },
      dateField: 'expires',
      titleField: 'name',
      searchable: ['name'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'item',
      label: 'Vorrat anlegen',
      description: 'Vorrat mit Ort, Anzahl und Ablaufdatum',
      fields: ['name', 'place', 'count', 'expires'],
      required: ['name'],
      parse: {
        keywords: ['vorrat', 'vorräte', 'kühlschrank', 'tiefkühl'],
        values: {
          place: {
            fridge: ['kühlschrank'],
            freezer: ['tiefkühl', 'gefrier'],
            pantry: ['vorratsschrank', 'speisekammer'],
          },
        },
      },
      examples: [
        {
          input: 'Vorrat Joghurt 4 Stück Kühlschrank bis 10.10.',
          output: { name: 'Joghurt', count: 4, place: 'fridge', expires: '2026-10-10' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'item',
      label: 'Vorrat ändern',
      description: 'Anzahl, Ort oder Ablaufdatum ändern',
      fields: ['name', 'place', 'count', 'expires'],
      examples: [
        {
          input: 'Ändere den Vorrat Joghurt auf 12.10.',
          target: 'Joghurt',
          output: { expires: '2026-10-12' },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'item',
      label: 'Vorrat löschen',
      description: 'Vorrat entfernen',
      examples: [{ input: 'Lösche den Vorrat Joghurt', target: 'Joghurt', output: {} }],
    },
  },
};
