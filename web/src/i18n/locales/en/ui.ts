import type { Strings } from '@/strings';

export const ui: Strings['ui'] = {
  selectRow: 'Auswählen',
  searchPlaceholder: 'Suchen …',
  retry: 'Erneut versuchen',
  loading: 'Wird geladen',
  discardTitle: 'Entwurf verwerfen?',
  discardHint: 'Deine Eingaben gehen verloren.',
  keepEditing: 'Weiter bearbeiten',
  discard: 'Verwerfen',
  grabHandle: 'Zum Schließen nach unten ziehen',
  undo: 'Rückgängig',
  undone: 'Rückgängig gemacht.',
  undoFailed: 'Das ließ sich nicht mehr rückgängig machen.',
  nothingToUndo: 'Nichts zum Rückgängigmachen.',
  selection: 'Auswahl',
  selected: (n: number) => (n === 1 ? '1 ausgewählt' : `${n} ausgewählt`),
};
