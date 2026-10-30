import type { Strings } from '@/strings';

export const homeEdit: Strings['homeEdit'] = {
  showMore: (n: number) => (n === 1 ? 'Show more · 1 card' : `Show more · ${n} cards`),
  pinStart: 'Add card…',
  pin: (title: string) => `Add ${title}`,
  unpin: (title: string) => `Remove ${title}`,
  pinned: 'Added',
  pinNote: 'Added cards stay visible in the calm view.',
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
  widgets: 'Cards',
  widgetsTitle: 'Overview cards',
  widgetsNote:
    'Hiding only affects the Overview; the module stays active. You can turn modules off in the library.',
  widgetsNone: 'No active modules with cards.',
  reset: 'Reset',
  resetTitle: 'Reset Overview?',
  resetText:
    'Order, sizes and hidden cards go back to the default. Your modules and data stay unchanged.',
  resetConfirm: 'Reset to default',
  cancel: 'Cancel',
  size: (title: string) => `Size of ${title}`,
  sizeOptions: { s: 'S', m: 'M', l: 'L' } as Record<string, string>,
};
