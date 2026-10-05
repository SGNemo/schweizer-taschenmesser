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
  actions: {
    create: {
      kind: 'create',
      collection: 'goal',
      label: 'Sparziel anlegen',
      description: 'Sparziel mit Zielbetrag und optionaler Frist',
      fields: ['name', 'targetMinor', 'deadline', 'note'],
      required: ['name', 'targetMinor'],
      parse: { keywords: ['sparziel', 'sparen'] },
      examples: [
        {
          input: 'Sparziel Urlaub 1.500 € bis 30.06.2027',
          output: { name: 'Urlaub', targetMinor: 150000, deadline: '2027-06-30' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'goal',
      label: 'Sparziel ändern',
      description: 'Zielbetrag, Frist oder Name ändern',
      fields: ['name', 'targetMinor', 'deadline', 'note'],
      examples: [
        {
          input: 'Ändere das Sparziel Urlaub auf 2.000 €',
          target: 'Urlaub',
          output: { targetMinor: 200000 },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'goal',
      label: 'Sparziel löschen',
      description: 'Sparziel löschen',
      examples: [{ input: 'Lösche das Sparziel Urlaub', target: 'Urlaub', output: {} }],
    },
  },
};
