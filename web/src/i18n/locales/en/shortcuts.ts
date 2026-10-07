import type { Strings } from '@/strings';

export const shortcuts: Strings['shortcuts'] = {
  title: 'Keyboard shortcuts',
  hint: 'Single letters only work when you are not typing in a field.',
  items: [
    { keys: ['Ctrl', 'K'], text: 'Search or ask' },
    { keys: ['N'], text: 'Add new' },
    { keys: ['G', 'then H'], text: 'Go to Overview' },
    {
      keys: ['G', 'then P / G / A / W / T'],
      text: 'Go to Plan, Money, Household, Knowledge, Vault',
    },
    { keys: ['J', 'K'], text: 'Next / previous row (also ↓ ↑)' },
    { keys: ['Enter'], text: 'Open row' },
    { keys: ['E'], text: 'Edit row' },
    { keys: ['Space'], text: 'Tick off row' },
    { keys: ['/'], text: 'Search list' },
    { keys: ['Ctrl', 'Z'], text: 'Undo last action' },
    { keys: ['Alt', 'L'], text: 'Turn reading aid on or off' },
    { keys: ['Esc'], text: 'Close / clear selection' },
    { keys: ['Alt', 'Home'], text: 'Go to Overview' },
    { keys: ['?'], text: 'This overview' },
  ],
};
