import type { Strings } from '@/strings';

export const assign: Strings['assign'] = {
  label: 'Para',
  none: '– ninguém –',
  removed: '(pessoa removida)',
  filter: 'Para quem',
  all: 'Todos',
  forName: (name: string) => `para ${name}`,
};
