import type { Strings } from '@/strings';

export const ui: Strings['ui'] = {
  selectRow: 'Selecionar',
  searchPlaceholder: 'Buscar …',
  retry: 'Tentar de novo',
  loading: 'Carregando',
  discardTitle: 'Descartar rascunho?',
  discardHint: 'O que você digitou será perdido.',
  keepEditing: 'Continuar editando',
  discard: 'Descartar',
  grabHandle: 'Arraste para baixo para fechar',
  undo: 'Desfazer',
  undone: 'Desfeito.',
  rowMenu: 'Mais ações',
  datePresetsLabel: 'Escolha rápida',
  datePresets: { today: 'Hoje', tomorrow: 'Amanhã', nextWeek: 'Próxima semana' },
  deleted: 'Excluído.',
  changed: 'Alterado.',
  undoFailed: 'Não foi mais possível desfazer.',
  nothingToUndo: 'Nada para desfazer.',
  selection: 'Seleção',
  selected: (n: number) => (n === 0 || n === 1 ? `${n} selecionado` : `${n} selecionados`),
};
