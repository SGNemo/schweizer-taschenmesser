import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Gewohnheiten (Habit-Tracker); Erledigt-Häkchen pro Tag sind nicht abfragbar',
  collections: {
    habit: {
      label: 'Gewohnheit',
      fields: { name: 'text', archived: 'bool' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
};
