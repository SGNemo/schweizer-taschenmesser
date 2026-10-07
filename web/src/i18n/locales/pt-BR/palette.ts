import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'config',
  recent: 'Usados recentemente',
  title: 'Paleta de comandos',
  placeholder: 'Buscar, navegar ou perguntar …',
  empty: 'Nenhum resultado',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Novo: ${what}`,
  nextReminder: 'Próximo lembrete',
  randomReminder: 'Lembrete aleatório',
};
