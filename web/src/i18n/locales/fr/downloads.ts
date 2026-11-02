import type { Strings } from '@/strings';

export const downloads: Strings['downloads'] = {
  meta: {
    name: 'Téléchargements',
    description:
      'Télécharge des fichiers : progression, pause, reprise, limite de débit et somme de contrôle. Rien ne s’ouvre automatiquement.',
    widget: 'Téléchargements en cours',
    widgetEmpty: 'Aucun téléchargement.',
    widgetAction: 'Ajouter un téléchargement',
    widgetSummary: (running: number, waiting: number) =>
      waiting > 0
        ? `${running} en cours · ${waiting} en attente ou en pause`
        : running === 1
          ? '1 en cours'
          : `${running} en cours`,
  },
  settings: {
    limitKb: 'Limite de débit pour tous les téléchargements (Ko/s, 0 = illimité)',
    folder: 'Dossier de téléchargement (vide = le dossier Téléchargements du système)',
    torrent: 'Activer la partie BitTorrent',
    torrentDht:
      'Chercher des participants via le réseau DHT (nécessaire pour les liens magnet sans tracker)',
    torrentUpnp: 'Ouvrir automatiquement le port du routeur (UPnP)',
    torrentUpKb: 'Torrent : limite d’envoi (Ko/s, 0 = illimité)',
    torrentDownKb: 'Torrent : limite de téléchargement (Ko/s, 0 = illimité)',
    seedRatio: 'Arrêter le partage à ce ratio (0 = jamais)',
    seedMinutes: 'Arrêter le partage après ce nombre de minutes (0 = jamais)',
  },
  unsupported: {
    title: 'Le gestionnaire de téléchargements n’existe que dans l’application de bureau',
    body: 'Sur cet appareil, le navigateur de votre appareil télécharge les fichiers.',
  },
  hint: 'Les fichiers vont uniquement dans le dossier choisi. Nemo ne les ouvre ni ne les lance jamais.',
  add: {
    button: 'Ajouter un téléchargement',
    title: 'Ajouter un téléchargement',
    url: 'Adresse (http:// ou https://)',
    folder: 'Dossier',
    pick: 'Choisir le dossier',
    hash: 'Somme de contrôle (facultatif, SHA-256 ou SHA-512)',
    hashHelp: 'Le fichier terminé est comparé avec elle.',
    submit: 'Télécharger',
    cancel: 'Annuler',
    http: 'Cette adresse n’est pas chiffrée (HTTP).',
  },
  errors: {
    scheme: 'Seules les adresses en http:// ou https:// fonctionnent.',
    url: 'Ce n’est pas une adresse valide.',
    dir: 'Le dossier n’existe pas.',
    hash: 'La somme de contrôle doit comporter 64 (SHA-256) ou 128 (SHA-512) caractères parmi 0–9 et a–f.',
    other: 'Cela n’a pas fonctionné.',
  },
  state: {
    queued: 'En attente',
    running: 'Téléchargement',
    paused: 'En pause',
    done: 'Terminé',
    failed: 'Échec',
  },
  failed: {
    http: 'Le serveur n’a pas fourni le fichier.',
    io: 'Le fichier n’a pas pu être écrit.',
    checksum: 'La somme de contrôle ne correspond pas. Le fichier a été supprimé.',
    size: 'Le fichier est arrivé incomplet.',
  },
  row: {
    progress: (done: string, total: string) => `${done} sur ${total}`,
    unknownTotal: (done: string) => `${done} téléchargés`,
    speed: (perSecond: string) => `${perSecond}/s`,
    limited: (perSecond: string) => `Limite ${perSecond}/s`,
  },
  actions: {
    pause: 'Mettre en pause',
    resume: 'Reprendre',
    retry: 'Réessayer',
    reveal: 'Afficher dans le dossier',
    remove: 'Retirer de la liste',
    removeData: 'Supprimer avec le fichier',
    more: 'Plus',
  },
  checksum: {
    label: 'SHA-256',
    verify: 'Comparer la somme de contrôle',
    verifyTitle: 'Comparer la somme de contrôle',
    field: 'Somme de contrôle (SHA-256 ou SHA-512)',
    match: 'Correspond',
    mismatch: 'Ne correspond pas',
    submit: 'Comparer',
  },
  deleteData: {
    title: 'Supprimer le fichier ?',
    body: (name: string) => `« ${name} » est supprimé du disque, même s’il est inachevé.`,
    confirm: 'Supprimer',
  },
  empty: {
    title: 'Pas encore de téléchargements',
    body: 'Collez une adresse ou téléchargez quelque chose dans le navigateur. Rien ne s’ouvre automatiquement.',
  },
  torrent: {
    title: 'BitTorrent',
    intro:
      'Des liens magnet et des fichiers .torrent que vous collez ou ouvrez vous-même. Nemo ne cherche rien et ne recommande aucun site.',
    hint: 'Uniquement pour des contenus légaux. Pendant le téléchargement, vous envoyez en même temps.',
    off: {
      title: 'BitTorrent est désactivé',
      body: 'La partie torrents est désactivée. En l’activant, un bref avis s’affiche d’abord.',
      turnOn: 'Activer la partie torrents',
    },
    turnOff: 'Désactiver la partie torrents',
    starting: 'Démarrage …',
    startFailed: 'La partie torrents n’a pas pu démarrer.',
    add: {
      button: 'Ajouter un torrent',
      title: 'Ajouter un torrent',
      magnet: 'Lien magnet',
      magnetPlaceholder: 'magnet:?xt=urn:btih:…',
      or: 'ou',
      openFile: 'Ouvrir un fichier .torrent',
      chosen: 'Fichier choisi',
      look: 'Voir les fichiers',
      looking: 'Recherche de sources … cela peut prendre un moment.',
      files: 'Fichiers',
      all: 'Tous',
      none: 'Aucun',
      selected: 'Sélectionné',
      pickOne: 'Choisissez au moins un fichier.',
      submit: 'Télécharger',
      back: 'Retour',
    },
    errors: {
      off: 'La partie torrents est désactivée.',
      file: 'Ce n’est pas un fichier .torrent valide (10 Mo au maximum).',
      notMagnet: 'Ce n’est pas un lien magnet.',
      timeout: 'Aucune source trouvée. Vérifiez le lien ou réessayez plus tard.',
      alreadyAdded: 'Ce torrent est déjà dans la liste.',
      dir: 'Le dossier n’existe pas.',
      other: 'Cela n’a pas fonctionné.',
    },
    state: {
      starting: 'Démarrage',
      downloading: 'Téléchargement',
      seeding: 'Partage',
      paused: 'En pause',
      done: 'Terminé, partage arrêté',
      error: 'Erreur',
    },
    row: {
      peers: (n: number) => (n === 1 ? '1 connexion' : `${n} connexions`),
      down: (speed: string) => `Réception ${speed}/s`,
      up: (speed: string) => `Envoi ${speed}/s`,
      ratio: (ratio: string) => `Ratio ${ratio}`,
    },
    actions: {
      pause: 'Mettre en pause',
      resume: 'Reprendre',
      remove: 'Retirer de la liste',
      removeData: 'Supprimer avec les fichiers',
    },
    deleteData: {
      title: 'Supprimer les fichiers ?',
      body: (name: string) =>
        `« ${name} » est supprimé du disque avec tous les fichiers téléchargés.`,
      confirm: 'Supprimer',
    },
    ip: {
      title: 'Votre adresse IP publique',
      note: 'Pendant le téléchargement, les autres participants voient votre adresse IP. Vous pouvez la voir ici aussi (une requête à api.ipify.org, uniquement sur clic).',
      button: 'Afficher l’adresse IP',
      failed: 'La requête n’a pas fonctionné.',
    },
    empty: {
      title: 'Pas encore de torrents',
      body: 'Ajoutez un lien magnet ou un fichier .torrent que vous avez vous-même.',
    },
  },
};
