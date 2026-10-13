import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'ajus',
  recent: 'Usado recientemente',
  title: 'Paleta de comandos',
  placeholder: 'Buscar, saltar o preguntar …',
  empty: 'Sin resultados',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Nuevo: ${what}`,
  nextReminder: 'Próximo recordatorio',
  randomReminder: 'Recordatorio al azar',
};
