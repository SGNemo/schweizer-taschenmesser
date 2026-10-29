import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'config',
  recent: 'Usados recentemente',
  title: 'Buscar',
  placeholder: 'Buscar, navegar ou perguntar …',
  empty: 'Nenhum resultado',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Novo: ${what}`,
  helpCommand: 'Abrir ajuda e guia',
  nextReminder: 'Mostrar o próximo lembrete',
  randomReminder: 'Mostrar um lembrete',
};
