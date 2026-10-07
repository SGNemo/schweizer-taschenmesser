import type { Strings } from '@/strings';

export const library: Strings['library'] = {
  title: 'Modul-Bibliothek',
  intro: 'Aktiviere nur, was du brauchst. Deaktivierte Module bleiben unsichtbar.',
  other: 'Weitere Module',
  active: 'Aktiv',
  nowActive: (name: string) => `Das Modul „${name}“ ist jetzt eingeschaltet.`,
  inactive: 'Inaktiv',
  disableTitle: (name: string) => `„${name}“ deaktivieren?`,
  disableText: 'Was soll mit den gespeicherten Daten dieses Moduls passieren?',
  keepData: 'Daten behalten (ausgeblendet)',
  keepDataHint: 'Bei erneutem Aktivieren ist alles wieder da.',
  deleteData: 'Daten löschen',
  deleteDataHint: 'Alle Einträge dieses Moduls werden entfernt.',
  devOnly: 'Entwickler',
};
