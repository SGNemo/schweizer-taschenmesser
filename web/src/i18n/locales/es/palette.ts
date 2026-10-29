import type { Strings } from '@/strings';

export const palette: Strings['palette'] = {
  /** Typing the start of the word for settings shows settings entries (first letters, lower case). */
  settingsPrefix: 'ajus',
  recent: 'Usado recientemente',
  title: 'Buscar',
  placeholder: 'Buscar, saltar o preguntar …',
  empty: 'Sin resultados',
  hint: 'Ctrl+K',
  newEntry: (what: string) => `Nuevo: ${what}`,
  helpCommand: 'Abrir ayuda y guía',
  nextReminder: 'Mostrar el próximo recordatorio',
  randomReminder: 'Mostrar un recordatorio',
};
