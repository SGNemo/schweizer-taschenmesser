import type { Strings } from '@/strings';

export const assign: Strings['assign'] = {
  label: 'Pour',
  none: '– personne –',
  removed: '(personne supprimée)',
  filter: 'Pour qui',
  all: 'Tous',
  forName: (name: string) => `pour ${name}`,
};
