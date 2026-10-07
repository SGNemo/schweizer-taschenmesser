import type { Strings } from '@/strings';

export const library: Strings['library'] = {
  title: 'Module library',
  intro: 'Only turn on what you need. Inactive modules stay hidden.',
  other: 'More modules',
  active: 'Active',
  nowActive: (name: string) => `The “${name}” module is now on.`,
  inactive: 'Inactive',
  disableTitle: (name: string) => `Turn off “${name}”?`,
  disableText: 'What should happen to the data saved in this module?',
  keepData: 'Keep data (hidden)',
  keepDataHint: 'Turn it on again and everything is back.',
  deleteData: 'Delete data',
  deleteDataHint: 'All entries of this module are removed.',
  devOnly: 'Developer',
};
