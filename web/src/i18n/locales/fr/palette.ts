import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'param',
  recent: 'Utilisés récemment',
  title: 'Rechercher',
  placeholder: 'Rechercher, naviguer ou demander…',
  empty: 'Aucun résultat',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Nouveau : ${what}`,
  helpCommand: 'Ouvrir l’aide et le guide',
  nextReminder: 'Afficher le prochain rappel',
  randomReminder: 'Afficher un rappel',
};
