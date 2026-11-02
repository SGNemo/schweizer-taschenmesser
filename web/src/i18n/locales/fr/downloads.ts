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
};
