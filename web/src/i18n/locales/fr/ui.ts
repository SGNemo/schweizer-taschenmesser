import type { Strings } from '@/strings';

export const ui: Strings['ui'] = {
  selectRow: 'Sélectionner',
  searchPlaceholder: 'Rechercher…',
  retry: 'Réessayer',
  loading: 'Chargement',
  discardTitle: 'Abandonner le brouillon ?',
  discardHint: 'Vos saisies seront perdues.',
  keepEditing: 'Continuer',
  discard: 'Abandonner',
  grabHandle: 'Glisser vers le bas pour fermer',
  undo: 'Annuler',
  undone: 'Annulé.',
  undoFailed: 'Cela ne pouvait plus être annulé.',
  nothingToUndo: 'Rien à annuler.',
  selection: 'Sélection',
  selected: (n: number) => (n <= 1 ? `${n} sélectionné` : `${n} sélectionnés`),
};
