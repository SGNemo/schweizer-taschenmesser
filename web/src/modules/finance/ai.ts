import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Konten mit Anfangssaldo, Buchungen (Ausgabe/Einnahme, Betrag in Cent, positiv) und Kategorien; Kontostand = Anfangssaldo + Einnahmen - Ausgaben',
  computed: {
    balance: 'Kontostand je Konto, gesamt und verfügbar nach offenen Rechnungen und Abos',
  },
  collections: {
    transaction: {
      label: 'Buchung',
      fields: {
        kind: 'enum:expense|income',
        amountMinor: 'money',
        date: 'date',
        payee: 'text',
        note: 'text',
      },
      dateField: 'date',
      titleField: 'payee',
      searchable: ['payee', 'note'],
    },
    account: {
      label: 'Konto',
      fields: { name: 'text', openingBalanceMinor: 'money' },
      titleField: 'name',
      searchable: ['name'],
    },
    category: {
      label: 'Kategorie',
      fields: { name: 'text', kind: 'enum:expense|income' },
      titleField: 'name',
      searchable: ['name'],
    },
  },
  actions: {
    create: {
      kind: 'create',
      collection: 'transaction',
      label: 'Buchung anlegen',
      description: 'Ausgabe oder Einnahme buchen (Betrag positiv, kind=expense|income)',
      fields: ['kind', 'amountMinor', 'date', 'payee', 'note'],
      required: ['amountMinor'],
      parse: {
        keywords: ['ausgabe', 'einnahme', 'buchung', 'zahlung', 'gehalt', 'lohn'],
        values: {
          kind: {
            income: [
              'einnahme',
              'gehalt',
              'lohn',
              'erstattung',
              'gutschrift',
              'erhalten',
              'eingang',
            ],
            expense: ['ausgabe', 'ausgegeben', 'gezahlt', 'zahlung'],
          },
        },
        defaults: { kind: 'expense', date: '@today' },
      },
      examples: [
        {
          input: 'Ausgabe 23,50 € Supermarkt gestern',
          output: { kind: 'expense', amountMinor: 2350, payee: 'Supermarkt', date: '2026-09-28' },
        },
      ],
    },
    update: {
      kind: 'update',
      collection: 'transaction',
      label: 'Buchung ändern',
      description: 'Betrag, Datum oder Empfänger einer Buchung ändern',
      fields: ['amountMinor', 'date', 'payee', 'note', 'kind'],
      examples: [
        {
          input: 'Ändere die Buchung Supermarkt auf 25 €',
          target: 'Supermarkt',
          output: { amountMinor: 2500 },
        },
      ],
    },
    delete: {
      kind: 'delete',
      collection: 'transaction',
      label: 'Buchung löschen',
      description: 'Buchung löschen',
      examples: [{ input: 'Lösche die Buchung Supermarkt', target: 'Supermarkt', output: {} }],
    },
  },
};
