import type { ModuleAiSchema } from '@/core/modules/types';

/** Compact description for the assistant (names of fields, never values; no sessions, no amounts). */
export const aiSchema: ModuleAiSchema = {
  description: 'Zeiterfassung: Projekte mit Stundensatz, auf die Zeit gebucht wird',
  collections: {
    job: {
      label: 'Projekt',
      fields: { name: 'text', billable: 'bool', archived: 'bool' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'job',
      label: 'Projekt anlegen',
      description: 'Neues Projekt für die Zeiterfassung',
      fields: ['name'],
      required: ['name'],
      parse: { keywords: ['zeiterfassung', 'stundenzettel', 'zeitprojekt'] },
      examples: [
        {
          input: 'Neues Zeiterfassungs-Projekt Website Relaunch',
          output: { name: 'Website Relaunch' },
        },
      ],
    },
    archive: {
      kind: 'transition',
      collection: 'job',
      label: 'Projekt archivieren',
      description: 'Projekt der Zeiterfassung archivieren (die Zeiten bleiben)',
      set: { archived: true },
      parse: { keywords: ['archivieren', 'archiviere', 'abschließen'] },
      examples: [
        {
          input: 'Zeiterfassungs-Projekt Website Relaunch archivieren',
          target: 'Website Relaunch',
          output: { archived: true },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'job',
      label: 'Projekt löschen',
      description: 'Projekt der Zeiterfassung löschen',
      examples: [
        {
          input: 'Lösche das Zeiterfassungs-Projekt Website Relaunch',
          target: 'Website Relaunch',
          output: {},
        },
      ],
    },
  },
};
