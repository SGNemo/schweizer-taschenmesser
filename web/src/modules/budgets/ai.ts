import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Sparziele mit Zielbetrag (Cent) und optionaler Frist; Einzahlungen sind nicht abfragbar',
  collections: {
    goal: {
      label: 'Sparziel',
      fields: { name: 'text', targetMinor: 'money', deadline: 'date', note: 'text' },
      dateField: 'deadline',
      titleField: 'name',
      searchable: ['name', 'note'],
    },
  },
};
