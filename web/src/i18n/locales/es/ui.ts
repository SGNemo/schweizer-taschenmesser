import type { Strings } from '@/strings';

export const ui: Strings['ui'] = {
  selectRow: 'Seleccionar',
  searchPlaceholder: 'Buscar …',
  retry: 'Reintentar',
  loading: 'Cargando',
  discardTitle: '¿Descartar borrador?',
  discardHint: 'Se perderá lo que has escrito.',
  keepEditing: 'Seguir editando',
  discard: 'Descartar',
  grabHandle: 'Desliza hacia abajo para cerrar',
  undo: 'Deshacer',
  undone: 'Deshecho.',
  undoFailed: 'Ya no se pudo deshacer.',
  nothingToUndo: 'Nada que deshacer.',
  selection: 'Selección',
  selected: (n: number) => (n === 1 ? '1 seleccionado' : `${n} seleccionados`),
};
