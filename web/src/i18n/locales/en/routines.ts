import type { Strings } from '@/strings';

export const routines: Strings['routines'] = {
  meta: {
    name: 'Routines',
    description:
      'Cleaning plan and household routines: what is due in which room how often, and whose turn it is. No backlog.',
    quickAdd: 'Routine',
    widget: 'Due today',
  },
  add: 'Add routine',
  addFirst: 'Add your first routine',
  edit: 'Edit routine',
  empty: 'No routines yet.',
  nothingDue: 'Nothing is due today.',
  due: 'due',
  dueGroup: 'Due today',
  done: 'Done',
  doneFor: (name: string) => `Done: ${name}`,
  doneToast: (name: string, next?: string) =>
    next ? `Done: ${name}. ${next}’s turn next.` : `Done: ${name}.`,
  turnOf: (name: string) => `${name}’s turn`,
  noRoom: 'No room',
  figureDetail: (n: number) => (n === 1 ? 'of 1 routine' : `of ${n} routines`),
  widgetSummary: (due: number, total: number) =>
    `${due} due · ${total === 1 ? '1 routine' : `${total} routines`}`,
  planTitle: (name: string, who?: string) => (who ? `${name} (${who})` : name),
  views: { label: 'Views', due: 'Due', all: 'All by room' },
  fields: {
    name: 'What',
    namePlaceholder: 'e.g. clean the bathroom',
    room: 'Room',
    people: 'Who takes turns',
    peopleHint:
      'Separate names with commas, in the order of the round. Leave empty if nobody is named.',
    dueDate: 'Next time',
    dueDatePast: 'A day in the past means: due now.',
    minutes: 'Duration in minutes',
    moreSummary: 'Names, next time, duration, note',
  },
};
