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
};
