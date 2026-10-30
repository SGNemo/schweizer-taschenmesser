import type { Strings } from '@/strings';

export const assign: Strings['assign'] = {
  label: 'For',
  none: '– nobody –',
  removed: '(person removed)',
  filter: 'For whom',
  all: 'Everyone',
  forName: (name: string) => `for ${name}`,
};
