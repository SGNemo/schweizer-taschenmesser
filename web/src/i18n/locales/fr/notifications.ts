import type { Strings } from '@/strings';

export const notifications: Strings['notifications'] = {
  summary: (count: number, titles: string[]) => ({
    title: `${count} rappels`,
    body: titles.slice(0, 3).join(' · ') + (titles.length > 3 ? '…' : ''),
  }),
  title: 'Notifications',
  intro:
    'Les rappels apparaissent en notification tant que l’app est ouverte ou en arrière-plan. Sans push, rien n’arrive quand l’app est fermée ; ce qui est arrivé à échéance entre-temps apparaît dans la cloche à l’ouverture. Avec le push (voir ci-dessous), ils arrivent aussi à ce moment-là.',
  introAndroid:
    'Sur Android, l’app confie les rappels au système pour qu’ils arrivent aussi quand l’app est fermée. Cela fonctionne si Nemo peut envoyer des notifications et utiliser « Alarmes et rappels » et que la batterie n’est pas restreinte (Réglages → Applications → Nemo).',
  introDesktop:
    'Les rappels apparaissent en notification tant que Nemo tourne, y compris en arrière-plan ou dans la zone de notification. Si l’app est quittée, ils n’arrivent pas ; ce qui est arrivé à échéance entre-temps apparaît dans la cloche au prochain démarrage.',
  enable: 'Activer les notifications',
  granted: 'Activées',
  denied: 'Bloquées – veuillez les autoriser pour ce site dans les paramètres du navigateur.',
  default: 'Pas encore activées',
  unsupported: 'Non prises en charge par ce navigateur.',
  test: 'Envoyer une notification de test',
  testBody: 'Ça fonctionne.',
  push: {
    title: 'Push quand l’app est fermée',
    intro:
      'Facultatif : votre serveur de synchronisation envoie les rappels par Web Push, même quand l’app est fermée. Pour cela, l’app envoie à votre serveur les notifications prévues pour les deux prochaines semaines (titre et texte) – uniquement chiffrées si le chiffrement de bout en bout est actif.',
    state: {
      unsupported: 'Ce navigateur ne prend pas en charge Web Push.',
      'needs-sync':
        'Push nécessite la connexion à votre serveur de synchronisation (Paramètres → Synchronisation).',
      denied:
        'Les notifications sont bloquées – veuillez les autoriser dans les paramètres du navigateur.',
      off: 'Désactivé',
      on: 'Actif sur cet appareil',
    } as Record<string, string>,
    enable: 'Activer Push',
    disable: 'Désactiver Push',
    test: 'Envoyer un test via le serveur',
    testSent: 'Envoyé – la notification devrait apparaître dans un instant.',
    testFailed: 'Le serveur n’a pas pu envoyer (service Push injoignable ?).',
    errors: {
      unauthorized: 'Le Token du serveur de synchronisation a été refusé.',
      network: 'Le serveur de synchronisation est injoignable.',
      server: 'Le serveur de synchronisation a signalé une erreur (est-il à jour ?).',
      'subscribe-failed':
        'L’abonnement n’a pas pu être créé. Push nécessite HTTPS et un navigateur avec service Push.',
      denied: 'Les notifications n’ont pas été autorisées.',
      unsupported: 'Ce navigateur ne prend pas en charge Web Push.',
      'needs-sync': 'Veuillez d’abord vous connecter au serveur de synchronisation.',
    } as Record<string, string>,
  },
};
