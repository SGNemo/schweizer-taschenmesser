import type { Strings } from '@/strings';

export const update: Strings['update'] = {
  title: 'Mises à jour de l’app',
  available: (version: string) => `Mise à jour disponible (v${version})`,
  beta: 'Bêta',
  whatsNew: 'Quoi de neuf ?',
  updateNow: 'Mettre à jour',
  later: 'Plus tard',
  backingUp: 'Copie de sauvegarde de vos données en cours…',
  downloading: 'Téléchargement de la mise à jour…',
  downloadingPercent: (pct: number) => `Téléchargement de la mise à jour… ${pct} %`,
  handover: 'Presque fini – l’app va redémarrer ou Android va ouvrir l’installation.',
  needsPermission:
    'Android a encore besoin de votre autorisation pour installer des apps depuis cette source. Activez l’option dans les paramètres, puis touchez à nouveau « Mettre à jour ».',
  retry: 'Réessayer',
  errors: {
    'check-failed': 'La recherche de mises à jour a échoué. Êtes-vous en ligne ?',
    'backup-failed':
      'La copie de sauvegarde n’a pas pu être créée – la mise à jour n’a donc pas été lancée.',
    'install-failed': 'La mise à jour n’a pas pu être installée.',
    'folder-not-writable':
      'Le programme se trouve dans un dossier où l’app ne peut pas écrire (protégé en écriture ou sans autorisation). Déplacez le programme dans un dossier normal, par ex. votre dossier utilisateur, puis réessayez.',
    'signature-invalid':
      'La signature de la mise à jour n’est pas valide – elle n’a donc pas été installée.',
  } as Record<string, string>,
  settings: {
    intro:
      'L’app installée vérifie sur GitHub s’il existe une nouvelle version. Avant chaque mise à jour, elle crée automatiquement une copie de sauvegarde de vos données.',
    version: 'Version installée',
    channel: 'Canal de mise à jour',
    channelStable: 'Stable',
    channelBeta: 'Bêta (préversions incluses)',
    auto: 'Rechercher les mises à jour automatiquement',
    autoHint: 'Au plus une fois par jour, au démarrage de l’app.',
    checkNow: 'Vérifier',
    checking: 'Recherche de mises à jour…',
    upToDate: 'Vous avez la dernière version.',
    browserHint:
      'Dans le navigateur, l’app se met à jour d’elle-même (avis en haut après le chargement d’une nouvelle version).',
    channelDev: 'Dev preview (chaque état de develop)',
    devHelp:
      'Les Dev previews sont des états intermédiaires non testés. Cette app est séparée de l’app Nemo stable et a ses propres données : transférez vos données par synchronisation ou sauvegarde. Avant chaque mise à jour, une copie de sauvegarde est créée automatiquement. Le retour à la version stable passe uniquement par l’installation de l’app stable.',
    devVersion: (version: string, sha: string) => `Dev preview ${version}${sha ? ` (${sha})` : ''}`,
  },
};
