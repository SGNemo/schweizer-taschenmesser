import type { Strings } from '@/strings';

export const connectors: Strings['connectors'] = {
  title: 'Connexions',
  errors: {
    expired: 'La connexion a expiré. Veuillez vous reconnecter.',
    'rate-limited': 'Le service signale trop de requêtes. Nouvel essai plus tard.',
    'not-configured': 'Il manque encore des identifiants.',
    'no-proxy':
      'Dans le navigateur, cette récupération nécessite le serveur de synchronisation (Paramètres → Synchronisation).',
    network: 'Le service est momentanément injoignable.',
    denied: 'La connexion a été annulée ou refusée.',
    'bad-response': 'Le service a envoyé une réponse inattendue.',
    unsupported: 'Ce n’est pas possible sur cet appareil.',
  } as Record<string, string>,
  icsName: 'Abonnement calendrier (ICS)',
  icsDescription:
    'Importer des événements depuis l’adresse d’un calendrier (lecture seule). Fonctionne avec Google Agenda, Outlook, Nextcloud et bien d’autres.',
  intro:
    'Récupérez des événements et des suggestions depuis les services que vous utilisez déjà. Tout est en lecture seule.',
  statusLabel: 'État',
  status: {
    disconnected: 'Non connecté',
    connected: 'Connecté',
    expired: 'Expiré',
    'rate-limited': 'En pause',
    error: 'Erreur',
  } as Record<string, string>,
  lastSync: (when: string) => `Dernière mise à jour : ${when}`,
  events: (n: number) => (n <= 1 ? `${n} événement importé` : `${n} événements importés`),
  connect: 'Connecter',
  reconnect: 'Se reconnecter',
  cancelLogin: 'Annuler la connexion',
  connecting: 'En attente de la connexion dans le navigateur…',
  disconnect: 'Déconnecter',
  syncNow: 'Mettre à jour maintenant',
  syncing: 'Mise à jour…',
  syncDone: (added: number, updated: number, removed: number) =>
    `Terminé : ${added} ${added <= 1 ? 'nouveau' : 'nouveaux'}, ${updated} ${updated <= 1 ? 'modifié' : 'modifiés'}, ${removed} ${removed <= 1 ? 'retiré' : 'retirés'}.`,
  desktopOnly:
    'La connexion ne fonctionne que dans l’app Windows. Sur le téléphone et dans le navigateur, les événements arrivent via la synchronisation ou un abonnement calendrier (ICS).',
  features: 'Que faut-il lire ?',
  calendars: 'Calendriers',
  calendarsHint: 'Seuls les calendriers cochés sont importés.',
  disconnectTitle: (name: string) => `Déconnecter ${name} ?`,
  disconnectBody:
    'L’accès est révoqué auprès du service et les identifiants enregistrés sont supprimés de cet appareil.',
  keepData: 'Garder les événements importés',
  deleteData: 'Supprimer les événements importés',
  client: {
    title: 'Votre propre application Google',
    intro:
      'Pour vous connecter, il vous faut votre propre « ID client OAuth » (type App de bureau) depuis la Google Cloud Console. Les instructions se trouvent dans docs/MANUAL-TESTS.md, section « Anleitungen für Sven ».',
    id: 'ID client',
    secret: 'Secret client',
    secretHint:
      'Google l’exige aussi pour les apps de bureau ; il n’y est pas considéré comme confidentiel.',
    save: 'Enregistrer',
    saved: 'Identifiants enregistrés.',
    missing: 'Saisissez d’abord l’ID client.',
  },
  scan: {
    title: 'Parcourir les e-mails',
    intro:
      'L’app ne lit des derniers e-mails que l’expéditeur, l’objet, la date et la ligne d’aperçu, et y cherche localement des factures, abonnements, événements et contrats. Seul ce que vous confirmez dans l’aperçu est enregistré ; le texte des e-mails n’est jamais enregistré ni envoyé à une IA.',
    period: 'Période',
    months: (n: number) => (n <= 1 ? 'Le mois dernier' : `Les ${n} derniers mois`),
    start: 'Lire les e-mails',
    reading: (done: number, total: number) => `Lecture des e-mails… ${done} sur ${total}`,
    summary: (n: number, months: number) =>
      `${n} e-mail${n <= 1 ? '' : 's'} ${n <= 1 ? 'lu' : 'lus'} sur ${months <= 1 ? 'le dernier mois' : `les ${months} derniers mois`} (expéditeur, objet, date, ligne d’aperçu).`,
    notConnected: 'Connectez d’abord Google dans Paramètres → Connexions et activez « E-mails ».',
    none: 'Rien de pertinent n’a été trouvé dans ces e-mails.',
  },
  ics: {
    listLabel: 'Abonnements calendrier',
    name: 'Nom (facultatif)',
    defaultName: (n: number) => `Calendrier ${n}`,
    url: 'Adresse du calendrier',
    urlHint:
      'p. ex. dans Google Agenda : Paramètres → Calendrier → Intégrer l’agenda → « Adresse secrète au format iCal ». Ne la partagez pas.',
    add: 'Ajouter un calendrier',
    checking: 'Vérification…',
    remove: (name: string) => `Retirer le calendrier « ${name} »`,
    badUrl: 'Ce n’est pas une adresse valide (https://… ou webcal://…).',
    notACalendar: 'Il n’y a pas de calendrier à cette adresse.',
    unreachable: 'L’adresse est injoignable.',
    noProxy:
      'Dans le navigateur, il faut pour cela le serveur de synchronisation (Paramètres → Synchronisation), car les services de calendrier bloquent la récupération depuis le navigateur.',
  },
  google: {
    name: 'Google',
    description:
      'Lire les calendriers et chercher des factures, abonnements, événements et contrats dans les e-mails. Lecture seule.',
    calendarFeature: 'Calendrier',
    calendarFeatureHint: 'Afficher les événements de vos agendas Google.',
    mailFeature: 'E-mails',
    mailFeatureHint: 'Chercher sur demande des factures, abonnements, événements et contrats.',
  },
};
