import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description: 'Rechnungen mit Empfänger, Betrag (Cent), Fälligkeit und Status open/paid',
  computed: { open: 'Summe, Anzahl und nächste Fälligkeit der offenen Rechnungen' },
  collections: {
    invoice: {
      label: 'Rechnung',
      fields: {
        payee: 'text',
        amountMinor: 'money',
        dueDate: 'date',
        status: 'enum:open|paid',
        paidAt: 'date',
        note: 'text',
      },
      dateField: 'dueDate',
      titleField: 'payee',
      searchable: ['payee', 'note'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'invoice',
      label: 'Rechnung anlegen',
      description: 'Offene Rechnung mit Empfänger, Betrag und Fälligkeit',
      fields: ['payee', 'amountMinor', 'dueDate', 'note'],
      required: ['payee', 'amountMinor', 'dueDate'],
      parse: { keywords: ['rechnung'] },
      examples: [
        {
          input: 'Rechnung Stadtwerke 89,90 € fällig 15.10.',
          output: { payee: 'Stadtwerke', amountMinor: 8990, dueDate: '2026-10-15' },
        },
      ],
    },
    markPaid: {
      kind: 'transition',
      collection: 'invoice',
      label: 'Rechnung bezahlt',
      description: 'Rechnung als bezahlt markieren (bucht die Ausgabe in Finanzen)',
      set: { status: 'paid' },
      parse: { keywords: ['bezahlt', 'beglichen', 'gezahlt'] },
      examples: [
        {
          input: 'Markiere die Stadtwerke-Rechnung als bezahlt',
          target: 'Stadtwerke',
          output: { status: 'paid' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'invoice',
      label: 'Rechnung ändern',
      description: 'Empfänger, Betrag, Fälligkeit oder Notiz ändern',
      fields: ['payee', 'amountMinor', 'dueDate', 'note'],
      examples: [
        {
          input: 'Ändere den Betrag der Stadtwerke-Rechnung auf 95 €',
          target: 'Stadtwerke',
          output: { amountMinor: 9500 },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'invoice',
      label: 'Rechnung löschen',
      description: 'Rechnung löschen',
      examples: [{ input: 'Lösche die Rechnung Stadtwerke', target: 'Stadtwerke', output: {} }],
    },
  },
};
