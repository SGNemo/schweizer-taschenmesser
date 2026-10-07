import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'param',
  recent: 'Utilisés récemment',
  title: 'Palette de commandes',
  placeholder: 'Rechercher, naviguer ou demander…',
  empty: 'Aucun résultat',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Nouveau : ${what}`,
  nextReminder: 'Rappel suivant',
  randomReminder: 'Rappel au hasard',
};
