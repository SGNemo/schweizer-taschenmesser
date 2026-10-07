import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'sett',
  recent: 'Recently used',
  title: 'Command palette',
  placeholder: 'Search, jump or ask …',
  empty: 'No results',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `New: ${what}`,
  nextReminder: 'Next reminder',
  randomReminder: 'Random reminder',
};
