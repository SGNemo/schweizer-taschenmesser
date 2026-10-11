import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  calmNote: (n: number) =>
    n === 1 ? 'Calm view: 1 widget is hidden.' : `Calm view: ${n} widgets are hidden.`,
  showAll: 'Show all widgets',
  customize: 'Customise',
  done: 'Done',
  hide: 'Hide',
  show: 'Show',
  handle: (title: string) => `Move ${title}`,
  hidden: 'Hidden',
  instructions:
    'To move, press Space, move with the arrow keys and press Space again to drop. Esc cancels.',
  picked: (title: string) => `${title} picked up.`,
  moved: (title: string, pos: number) => `${title} moved to position ${pos}.`,
  dropped: (title: string, pos: number) => `${title} dropped at position ${pos}.`,
  cancelled: 'Move cancelled.',
  widgets: 'Widgets',
  widgetsTitle: 'Overview widgets',
  widgetsNote:
    'Hiding only affects the Overview; the module stays active. You can turn modules off in the library.',
  widgetsNone: 'No active modules with widgets.',
  reset: 'Reset',
  resetTitle: 'Reset Overview?',
  resetText:
    'Order, sizes and hidden widgets go back to the default. Your modules and data stay unchanged.',
  resetConfirm: 'Reset to default',
  cancel: 'Cancel',
  size: (title: string) => `Size of ${title}`,
  sizeOptions: { s: 'S', m: 'M', l: 'L' } as Record<string, string>,
};
