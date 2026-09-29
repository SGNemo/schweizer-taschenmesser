import type { ModuleAiSchema } from '@/core/modules/types';

export const aiSchema: ModuleAiSchema = {
  description:
    'Konten mit Anfangssaldo, Buchungen (Ausgabe/Einnahme, Betrag in Cent, positiv) und Kategorien; Kontostand = Anfangssaldo + Einnahmen - Ausgaben',
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
};
