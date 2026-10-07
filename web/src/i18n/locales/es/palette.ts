import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'einst',
  recent: 'Zuletzt benutzt',
  title: 'Befehlspalette',
  placeholder: 'Suchen, springen oder fragen …',
  empty: 'Keine Treffer',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Neu: ${what}`,
  nextReminder: 'Nächste Erinnerung',
  randomReminder: 'Zufällige Erinnerung',
};
