import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Geburtstage mit Name, Tag, Monat und optional Geburtsjahr (jährlich wiederkehrend)',
  collections: {
    birthday: {
      label: 'Geburtstag',
      fields: { name: 'text', month: 'num', day: 'num', year: 'num', note: 'text' },
      titleField: 'name',
      searchable: ['name', 'note'],
    },
  },
};
