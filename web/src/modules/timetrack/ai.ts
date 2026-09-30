import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description for the assistant; contains no user data. */
export const aiSchema: ModuleAiSchema = {
  description: 'Zeiterfassung: erfasste Arbeitszeit je Projekt und Tag',
  collections: {
    project: {
      label: 'Projekt',
      fields: { name: 'text', archived: 'bool' },
      titleField: 'name',
      searchable: ['name'],
    },
    entry: {
      label: 'Zeiteintrag',
      fields: { date: 'date', minutes: 'num', note: 'text' },
      dateField: 'date',
      titleField: 'note',
    },
  },
};
