import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description for the assistant (names of fields, never values). */
export const aiSchema: ModuleAiSchema = {
  description:
    'Gewohnheiten: tägliche oder wöchentliche Ziele (Ja/Nein oder eine Zahl wie „8 Gläser“)',
  collections: {
    goal: {
      label: 'Gewohnheit',
      fields: {
        name: 'text',
        kind: 'enum:yesno|count',
        target: 'num',
        unit: 'text',
        archived: 'bool',
      },
      titleField: 'name',
      searchable: ['name', 'unit'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'goal',
      label: 'Gewohnheit anlegen',
      description: 'Neue Gewohnheit: Name, Ja/Nein oder Zahl pro Tag mit Einheit',
      fields: ['name', 'kind', 'target', 'unit'],
      required: ['name'],
      parse: {
        keywords: ['gewohnheit', 'gewohnheiten', 'angewohnheit'],
        values: { kind: { count: ['zahl', 'gläser', 'glas', 'mal am tag'] } },
      },
      examples: [
        {
          input: 'Neue Gewohnheit Wasser trinken',
          output: { name: 'Wasser trinken' },
        },
      ],
    },
    archive: {
      kind: 'transition',
      collection: 'goal',
      label: 'Gewohnheit archivieren',
      description: 'Gewohnheit ins Archiv legen (alles bleibt erhalten)',
      set: { archived: true },
      parse: { keywords: ['archivieren', 'archiviere', 'archiv', 'beenden'] },
      examples: [
        {
          input: 'Gewohnheit Wasser trinken archivieren',
          target: 'Wasser trinken',
          output: { archived: true },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'goal',
      label: 'Gewohnheit löschen',
      description: 'Gewohnheit löschen',
      examples: [
        { input: 'Lösche die Gewohnheit Wasser trinken', target: 'Wasser trinken', output: {} },
      ],
    },
  },
};
