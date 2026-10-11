import type { Strings } from '@/strings';

export const ui: Strings['ui'] = {
  selectRow: 'Select',
  searchPlaceholder: 'Search …',
  retry: 'Try again',
  loading: 'Loading',
  discardTitle: 'Discard draft?',
  discardHint: 'What you entered will be lost.',
  keepEditing: 'Keep editing',
  discard: 'Discard',
  grabHandle: 'Drag down to close',
  undo: 'Undo',
  undone: 'Undone.',
  undoFailed: 'That could no longer be undone.',
  nothingToUndo: 'Nothing to undo.',
  selection: 'Selection',
  selected: (n: number) => `${n} selected`,
};
