import type { Strings } from '@/strings';

export const diskWidget: Strings['diskWidget'] = {
  title: 'Lecteurs',
  free: (free: string, total: string) => `${free} libres sur ${total}`,
  empty: 'Aucun lecteur trouvé.',
  open: 'Ouvrir les disques',
  unavailable: 'Les lecteurs ne sont pas disponibles ici.',
};
