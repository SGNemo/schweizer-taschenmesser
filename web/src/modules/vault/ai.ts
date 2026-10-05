import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Unterlagen (Ausweis, Versicherung, Vertrag, Garantie …) mit Ende/Ablauf und Kündigungsfrist; Dateien sind nicht abfragbar',
  collections: {
    document: {
      label: 'Unterlage',
      fields: {
        title: 'text',
        category: 'enum:identity|insurance|contract|warranty|tax|health|other',
        provider: 'text',
        startDate: 'date',
        endDate: 'date',
        noticeDays: 'num',
        note: 'text',
      },
      dateField: 'endDate',
      titleField: 'title',
      searchable: ['title', 'provider', 'note', 'fileName'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'document',
      label: 'Unterlage anlegen',
      description: 'Unterlage (nur Angaben, keine Datei) mit Anbieter, Ende und Kündigungsfrist',
      fields: ['title', 'category', 'provider', 'startDate', 'endDate', 'noticeDays', 'note'],
      required: ['title'],
      parse: {
        keywords: ['unterlage', 'dokument', 'vertrag', 'versicherung', 'garantie'],
        roles: { startDate: 'startDate', date: 'endDate' },
        values: {
          category: {
            insurance: ['versicherung'],
            contract: ['vertrag'],
            warranty: ['garantie'],
            identity: ['ausweis', 'reisepass'],
            tax: ['steuer'],
            health: ['impf', 'gesundheit'],
          },
        },
      },
      examples: [
        {
          input: 'Vertrag Handytarif läuft bis 30.06.2027',
          output: { title: 'Handytarif', category: 'contract', endDate: '2027-06-30' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'document',
      label: 'Unterlage ändern',
      description: 'Ende, Kündigungsfrist oder Notiz ändern',
      fields: ['title', 'category', 'provider', 'startDate', 'endDate', 'noticeDays', 'note'],
      parse: { keywords: ['unterlage'], roles: { date: 'endDate', startDate: 'startDate' } },
      examples: [
        {
          input: 'Verschiebe die Unterlage Handytarif auf 31.12.2027',
          target: 'Handytarif',
          output: { endDate: '2027-12-31' },
        },
      ],
    },
  },
};
