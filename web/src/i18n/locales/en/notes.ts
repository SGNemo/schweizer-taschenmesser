import type { Strings } from '@/strings';

export const notes: Strings['notes'] = {
  meta: {
    name: 'Notes',
    description:
      'Quick notes with title and text, a fixed scratchpad always at the top, pin important notes, with search.',
    route: 'Notes',
    widget: 'Notes',
    quickAdd: 'Note',
  },
  title: 'Notes',
  add: 'Add note',
  edit: 'Edit note',
  body: 'Text',
  pin: 'Pin to top',
  scratch: 'Scratchpad',
  scratchHint: 'For quick jottings, always at the top.',
  scratchClear: 'Clear scratchpad',
  search: 'Search notes',
  empty: 'No notes yet.',
  emptyFiltered: 'Nothing found.',
  widgetEmpty: 'No notes yet.',
};
