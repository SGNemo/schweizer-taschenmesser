import type { Strings } from '@/strings';

export const mail: Strings['mail'] = {
  meta: {
    name: 'Courrier',
    description:
      'Boîte de réception, recherche et lecture – lecture seule, sans IA dans le cloud. Utilise ton compte Google de Connexions.',
    quickAdd: 'Courrier : ouvrir la boîte de réception',
    images: 'Images dans les e-mails',
    imagesHelp:
      'Les images externes indiquent à l’expéditeur que tu as ouvert le message. Par défaut : charger seulement après un clic.',
    imagesAsk: 'Charger après un clic',
    imagesAlways: 'Toujours charger',
    cacheBodies: 'Garder les e-mails ouverts en cache',
    cacheBodiesHelp:
      'Chiffré sur cet appareil, non synchronisé et hors des sauvegardes. Sans cela, chaque e-mail est rechargé à l’ouverture.',
  },
  page: {
    refresh: 'Actualiser',
    loading: 'Chargement des e-mails …',
    more: 'Charger plus',
    searchLabel: 'Rechercher',
    searchPlaceholder: 'Rechercher, p. ex. from:nom has:attachment',
    searchHint:
      'La syntaxe de recherche de Gmail s’applique : from:, to:, subject:, has:attachment, newer_than:7d, label:…',
    searchEnd: 'Terminer la recherche',
    account: 'Compte',
    accountN: (n: number) => `Compte ${n}`,
    label: 'Dossier',
    empty: 'Aucun e-mail dans cette vue.',
    emptySearch: 'Rien trouvé.',
    settings: 'Réglages du courrier',
    unread: (n: number) => (n === 1 ? '1 non lu' : `${n} non lus`),
    messages: (n: number) => (n === 1 ? '1 message' : `${n} messages`),
    demo: 'E-mails d’exemple (données de test). Connecte Gmail pour voir les tiens.',
    cached: 'Pas de connexion : dernier état enregistré affiché.',
    groups: {
      today: 'Aujourd’hui',
      yesterday: 'Hier',
      week: 'Cette semaine',
      older: 'Plus ancien',
    },
    noSubject: '(sans objet)',
    labels: {
      INBOX: 'Boîte de réception',
      STARRED: 'Suivis',
      IMPORTANT: 'Importants',
      SENT: 'Envoyés',
      DRAFT: 'Brouillons',
      TRASH: 'Corbeille',
      SPAM: 'Spam',
    },
  },
  connect: {
    title: 'Aucun compte de messagerie connecté',
    body: 'Connecte ton compte Google dans les Réglages et active « Courrier ». Nemo ne fait que lire : rien n’est envoyé, supprimé ni déplacé.',
    action: 'Aller aux Connexions',
  },
  errors: {
    expired: 'La connexion à Google a expiré.',
    denied:
      'L’autorisation manque pour cela. Active « Courrier » dans Connexions et reconnecte-toi.',
    'rate-limited': 'Google ralentit les requêtes. Réessaie dans quelques minutes.',
    network: 'Pas de connexion au service de messagerie.',
    generic: 'Les e-mails n’ont pas pu être chargés.',
    action: 'Aller aux Connexions',
  },
  view: {
    back: 'Retour à la liste',
    from: 'De',
    to: 'À',
    cc: 'Cc',
    attachments: 'Pièces jointes',
    download: (name: string) => `Télécharger ${name}`,
    saved: 'Pièce jointe enregistrée.',
    downloadLabel: 'Télécharger',
    downloadFailed: 'La pièce jointe n’a pas pu être chargée.',
    blockedImages: (n: number) =>
      n === 1 ? '1 image externe bloquée' : `${n} images externes bloquées`,
    loadImages: 'Charger les images',
    loadingImages: 'Chargement des images …',
    trackers: (n: number) =>
      n === 1 ? '1 pixel espion supprimé' : `${n} pixels espions supprimés`,
    noBody: '(sans texte)',
    frameTitle: (subject: string) => `Contenu de l’e-mail : ${subject}`,
    readOnly: 'Nemo ne fait que lire : l’état « lu » ne change pas.',
    openInGmail: 'Ouvrir dans Gmail',
    expand: (who: string) => `Déplier le message de ${who}`,
    loadFailed: 'L’e-mail n’a pas pu être chargé.',
  },
  panel: {
    title: 'Réglages du courrier',
    accounts: 'Comptes',
    noAccounts: 'Aucun compte connecté.',
    accountsHint: 'Les comptes se connectent et se retirent dans Connexions.',
    manage: 'Ouvrir Connexions',
    scopes: 'Autorisation',
    scopesBody:
      'La lecture utilise l’autorisation Google « Lire Gmail » (gmail.readonly). Il n’y a pas encore d’autorisations d’écriture comme archiver ou répondre ; elles seraient activées une à une, avec une explication.',
    cache: 'Cache',
    cacheBody: (threads: number, bodies: number) =>
      `${threads} en-têtes et ${bodies} e-mails ouverts, chiffrés sur cet appareil. Non synchronisés, hors des sauvegardes.`,
    clear: 'Vider le cache',
    cleared: 'Cache vidé.',
    clearTitle: 'Vider le cache ?',
    clearBody: 'Les e-mails restent chez Google. Ils sont rechargés à la prochaine ouverture.',
    notifications: 'Notifications',
    notificationsBody:
      'Pas encore disponible : l’app ne signale pas d’elle-même les nouveaux e-mails.',
    close: 'Fermer',
  },
  widget: {
    unread: 'Non lus',
    unreadContext: (n: number) =>
      n === 0
        ? 'La boîte est vide'
        : n === 1
          ? 'Conversation non lue dans la boîte'
          : 'Conversations non lues dans la boîte',
    important: 'E-mails principaux',
    importantSummary: (n: number) => (n === 1 ? '1 non lu' : `${n} non lus`),
    invoices: 'E-mails de factures',
    invoicesContext: (days: number) => `ces ${days} derniers jours`,
    empty: 'Pas encore d’e-mails.',
    emptyAction: 'Ouvrir le courrier',
    link: 'Ouvrir le courrier',
  },
};
