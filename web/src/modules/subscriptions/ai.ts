import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Abos und wiederkehrende Zahlungen mit Betrag (Cent), Intervall und Kündigungsfrist in Tagen',
  computed: { costs: 'Kosten aller aktiven Abos pro Monat und pro Jahr' },
  collections: {
    subscription: {
      label: 'Abo',
      fields: {
        name: 'text',
        amountMinor: 'money',
        startDate: 'date',
        recurrence: 'recurrence',
        cancelNoticeDays: 'num',
        active: 'bool',
        note: 'text',
      },
      dateField: 'startDate',
      titleField: 'name',
      searchable: ['name', 'note'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'subscription',
      label: 'Abo anlegen',
      description: 'Abo mit Betrag, Intervall (recurrence) und Startdatum',
      fields: ['name', 'amountMinor', 'recurrence', 'startDate', 'cancelNoticeDays', 'note'],
      required: ['name', 'amountMinor', 'recurrence', 'startDate'],
      parse: {
        keywords: ['abo', 'abonnement', 'subscription'],
        defaults: { startDate: '@today' },
      },
      examples: [
        {
          input: 'Abo Netflix 12,99 € monatlich ab 1.11.',
          output: {
            name: 'Netflix',
            amountMinor: 1299,
            recurrence: { freq: 'monthly', interval: 1 },
            startDate: '2026-11-01',
          },
        },
      ],
    },
    cancel: {
      kind: 'transition',
      collection: 'subscription',
      label: 'Abo beenden',
      description: 'Abo als gekündigt (inaktiv) markieren',
      set: { active: false },
      parse: { keywords: ['gekündigt', 'kündige', 'beendet', 'beende'] },
      examples: [
        { input: 'Kündige das Abo Netflix', target: 'Netflix', output: { active: false } },
      ],
    },
    update: {
      kind: 'update',
      collection: 'subscription',
      label: 'Abo ändern',
      description: 'Betrag, Intervall, Name oder Kündigungsfrist ändern',
      fields: ['name', 'amountMinor', 'recurrence', 'startDate', 'cancelNoticeDays', 'note'],
      examples: [
        {
          input: 'Ändere das Abo Netflix auf 13,99 €',
          target: 'Netflix',
          output: { amountMinor: 1399 },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'subscription',
      label: 'Abo löschen',
      description: 'Abo löschen',
      examples: [{ input: 'Lösche das Abo Netflix', target: 'Netflix', output: {} }],
    },
  },
};
