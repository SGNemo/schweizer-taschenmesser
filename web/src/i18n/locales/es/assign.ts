import type { Strings } from '@/strings';

export const assign: Strings['assign'] = {
  label: 'Para',
  none: '– nadie –',
  removed: '(persona eliminada)',
  filter: 'Para quién',
  all: 'Todos',
  forName: (name: string) => `para ${name}`,
};
