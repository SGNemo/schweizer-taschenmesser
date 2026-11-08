import type { ModuleAiSchema } from '@/core/modules/types';

/**
 * Compact description for the assistant: field names only, never values. Health-adjacent data, so
 * nothing is searchable and the assistant can only create entries (always after a preview).
 */
export const aiSchema: ModuleAiSchema = {
  description: 'Fitness: Trainingseinheiten (Datum, Dauer) und Mahlzeiten mit kcal, grob',
  collections: {
    meal: {
      label: 'Mahlzeit',
      fields: { text: 'text', kcal: 'num', date: 'date' },
      titleField: 'text',
      dateField: 'date',
    },
    session: {
      label: 'Trainingseinheit',
      fields: { title: 'text', date: 'date', durationMin: 'num' },
      titleField: 'title',
      dateField: 'date',
    },
  },
  actions: {
    createMeal: {
      kind: 'create',
      collection: 'meal',
      label: 'Mahlzeit anlegen',
      description: 'Mahlzeit mit Text und kcal, Datum optional (sonst heute)',
      fields: ['text', 'kcal', 'date'],
      required: ['text', 'kcal'],
      parse: {
        keywords: ['mahlzeit', 'kcal', 'kalorien'],
        roles: { quantity: 'kcal' },
      },
      examples: [{ input: 'Mahlzeit Döner 650 kcal', output: { text: 'Döner', kcal: 650 } }],
    },
    createSession: {
      kind: 'create',
      collection: 'session',
      label: 'Trainingseinheit anlegen',
      description: 'Trainingseinheit mit Titel und Dauer in Minuten, Datum optional (sonst heute)',
      fields: ['title', 'date', 'durationMin'],
      required: ['title'],
      parse: {
        keywords: ['training', 'trainingseinheit', 'einheit'],
        roles: { estimate: 'durationMin' },
      },
      examples: [
        { input: 'Training Laufen 30 Minuten', output: { title: 'Laufen', durationMin: 30 } },
      ],
    },
  },
};
