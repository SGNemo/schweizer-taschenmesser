import type { Strings } from '@/strings';

export const chat: Strings['chat'] = {
  meta: {
    name: 'Chat',
    description:
      'Discussions avec le modèle local intégré ou vos fournisseurs ; si vous le souhaitez, avec des données de modules choisis.',
    route: 'Chat',
    widget: 'Chat',
    quickAdd: 'Nouveau chat',
  },
  title: 'Chat',
  newChat: 'Nouveau chat',
  chats: 'Chats',
  search: 'Rechercher dans les chats',
  empty: 'Aucun chat pour l’instant. Posez une question – rien n’est enregistré avant l’envoi.',
  emptyAction: 'Démarrer un chat',
  noThread: 'Choisissez un chat à gauche ou démarrez-en un nouveau.',
  back: 'Vers la liste des chats',
  placeholder: 'Écrire un message…',
  send: 'Envoyer',
  stop: 'Arrêter',
  you: 'Vous',
  assistant: 'Assistant',
  stageLocal: 'Local · 0 €',
  stageCloud: 'Cloud',
  engine: 'Répond avec',
  engineLocal: 'Modèle local',
  engineRouter: 'Mes fournisseurs',
  engineHintLocal: 'Fonctionne uniquement sur cet appareil, hors ligne, sans frais.',
  engineHintRouter: 'Le texte de ce chat est envoyé au fournisseur que vous avez configuré.',
  systemPrompt: 'Instruction personnelle pour ce chat',
  systemPromptHint: 'Par exemple : « Réponds brièvement, avec des phrases simples. »',
  rename: 'Renommer',
  pin: 'Épingler',
  unpin: 'Détacher',
  archive: 'Archiver',
  unarchive: 'Restaurer',
  showArchived: 'Afficher les archives',
  delete: 'Supprimer le chat',
  deleteTitle: 'Supprimer définitivement le chat ?',
  deleteBody: 'Tous les messages de ce chat seront supprimés.',
  deleteConfirm: 'Supprimer',
  cancel: 'Annuler',
  export: 'Exporter en Markdown',
  copy: 'Copier',
  copied: 'Copié.',
  regenerate: 'Régénérer',
  edit: 'Modifier',
  editSave: 'Enregistrer et redemander',
  retry: 'Réessayer',
  usage: (inTokens: number, outTokens: number, usd: number) =>
    `${inTokens} tokens envoyés · ${outTokens} reçus${
      usd > 0 ? ` · env. ${usd.toFixed(4).replace('.', ',')} $` : ''
    }`,
  pinned: 'Épinglés',
  context: {
    title: 'Données des modules',
    hint: 'Par défaut, le chat ne voit aucune donnée de l’app. Choisissez les modules à partir desquels il peut répondre ; vous voyez avant exactement ce qui est envoyé.',
    none: 'Aucun',
    attach: 'Joindre des données',
    attachHint: 'Cherche dans les modules choisis des données liées à votre question.',
    previewTitle: 'Voici ce qui sera envoyé',
    previewIntro: (cloud: boolean) =>
      cloud
        ? 'Ce texte est envoyé à votre fournisseur avec votre question.'
        : 'Ce texte reste sur cet appareil.',
    previewSend: 'Envoyer avec les données',
    previewWithout: 'Envoyer sans données',
    nothing: 'Aucune donnée n’a été trouvée pour cette question dans les modules choisis.',
    attached: 'Avec des données de l’app',
  },
  aiOff: 'L’IA est désactivée. Vous pouvez la réactiver dans Paramètres → IA.',
  errors: {
    'ai-off': 'L’IA est désactivée. Vous pouvez la réactiver dans Paramètres → IA.',
    'no-engine':
      'Aucun fournisseur n’est configuré. Configurez-en un dans Paramètres → IA ou choisissez le modèle local.',
    'local-unavailable':
      'Le modèle local n’est pas prêt. Téléchargez-le dans Paramètres → IA → Modèle local.',
    auth: 'Le fournisseur a refusé la clé.',
    'rate-limit': 'Le fournisseur limite les requêtes en ce moment. Réessayez dans un instant.',
    network: 'Pas de connexion au fournisseur.',
    'limit-reached': 'Vos limites pour aujourd’hui ou ce mois-ci sont atteintes.',
    aborted: 'Interrompu.',
    fallback: 'Cela n’a pas fonctionné.',
  } as Record<string, string>,
  settings: {
    defaultEngine: 'Les nouveaux chats répondent avec',
    keepDays: 'Supprimer les anciens chats après',
    keepForever: 'Jamais',
    keepDaysOption: (n: number) => `${n} jours`,
    keepHint:
      'Les chats épinglés sont conservés. La suppression a lieu à l’ouverture du module Chat.',
  },
  widget: {
    empty: 'Aucun chat pour l’instant.',
    link: 'Ouvrir le chat',
    line: (n: number) => (n <= 1 ? `${n} chat` : `${n} chats`),
  },
  seed: {
    title: 'Exemple : conseils pour le planning de la semaine',
    question: 'Comment planifier une semaine avec trois rendez-vous et des courses ?',
    answer:
      'Une méthode simple :\n\n1. Notez d’abord les **événements** fixes.\n2. Placez les **courses** un jour sans rendez-vous.\n3. Prévoyez une soirée libre.\n\nAinsi, il reste de la place pour l’imprévu.',
  },
};
