import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Packlisten (z. B. für Reisen) mit Gegenständen; packed = schon eingepackt',
  collections: {
    list: {
      label: 'Packliste',
      fields: { name: 'text', note: 'text' },
      titleField: 'name',
      searchable: ['name', 'note'],
    },
    item: {
      label: 'Gegenstand',
      fields: { name: 'text', packed: 'bool' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
};
