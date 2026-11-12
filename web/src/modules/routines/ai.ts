import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description sent to the LLM (stage 2). It never contains user data. Read-only: no actions. */
export const aiSchema: ModuleAiSchema = {
  description:
    'Haushalts-Routinen (Putzplan): was, in welchem Raum, wann wieder dran, wer ist dran',
  collections: {
    routine: {
      label: 'Routine',
      fields: {
        name: 'text',
        room: 'text',
        dueDate: 'date',
        repeat: 'recurrence',
        people: 'tags',
        lastDoneOn: 'date',
        note: 'text',
      },
      titleField: 'name',
      searchable: ['name', 'room', 'note'],
    },
  },
};
