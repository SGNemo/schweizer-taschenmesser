import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  recent: 'Zuletzt benutzt',
  title: 'Befehlspalette',
  placeholder: 'Suchen, springen oder fragen …',
  empty: 'Keine Treffer',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Neu: ${what}`,
  nextReminder: 'Nächste Erinnerung',
  randomReminder: 'Zufällige Erinnerung',
};
