import type { Strings } from '@/strings';

export const library: Strings['library'] = {
  title: 'Bibliothèque de modules',
  intro: 'Activez seulement ce dont vous avez besoin. Les modules désactivés restent invisibles.',
  other: 'Autres modules',
  active: 'Actif',
  nowActive: (name: string) => `Le module « ${name} » est maintenant activé.`,
  inactive: 'Inactif',
  disableTitle: (name: string) => `Désactiver « ${name} » ?`,
  disableText: 'Que faire des données enregistrées de ce module ?',
  keepData: 'Garder les données (masquées)',
  keepDataHint: 'Si vous le réactivez, tout sera de nouveau là.',
  deleteData: 'Supprimer les données',
  deleteDataHint: 'Toutes les entrées de ce module seront supprimées.',
  devOnly: 'Développeurs',
};
