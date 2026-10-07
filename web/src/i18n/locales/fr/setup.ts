import type { Strings } from '@/strings';

export const setup: Strings['setup'] = {
  title: 'Configuration',
  intro:
    'L’assistant vous aide à configurer les modules, les outils, les comptes et plus encore. Tout est facultatif : vous pouvez arrêter à tout moment et reprendre plus tard.',
  start: 'Lancer la configuration',
  resume: 'Reprendre la configuration',
  open: 'Ouvrir la configuration',
  paletteCommand: 'Configuration',
  welcomeTitle: 'Bienvenue dans Nemo',
  welcomeText:
    'Souhaitez-vous configurer l’app pas à pas ? Vous pouvez aussi le faire plus tard dans les paramètres.',
  welcomeLater: 'Plus tard',
  dialogTitle: 'Configuration',
  stepOf: (n: number, total: number) => `Étape ${n} sur ${total}`,
  progressLabel: 'Progression de la configuration',
  back: 'Retour',
  next: 'Suivant',
  skip: 'Passer',
  finish: 'Terminé',
  noSteps: 'Il n’y a rien à configurer pour le moment.',
  startTitle: 'Bon retour',
  startIntro: 'Les étapes déjà faites sont conservées.',
  resumeAt: (title: string) => `Reprendre à « ${title} »`,
  fromStart: 'Revoir depuis le début',
  fromStartHint:
    'Affiche à nouveau toutes les étapes. Les données déjà définies restent inchangées.',
  cancelTitle: 'Interrompre la configuration ?',
  cancelText:
    'Les étapes terminées sont conservées. Seule l’étape en cours, pas encore confirmée, est abandonnée.',
  later: 'Reprendre plus tard',
  end: 'Terminer la configuration',
  endHint:
    'Vous retrouverez ensuite les étapes restantes dans la liste de contrôle de la vue d’ensemble.',
  keepGoing: 'Continuer la configuration',
  commitFailed: 'L’étape n’a pas pu être enregistrée. Veuillez réessayer.',
  summaryTitle: 'Récapitulatif',
  summaryIntro: 'Où en est votre configuration :',
  statusDone: 'Terminé',
  statusSkipped: 'Passé',
  statusOpen: 'À faire',
  isNew: 'Nouveau',
  showChecklist: 'Afficher la liste de contrôle sur la vue d’ensemble',
  checklistProgress: (done: number, total: number) =>
    `${done} ${done <= 1 ? 'étape terminée' : 'étapes terminées'} sur ${total}`,
  moreOpen: (n: number) => (n <= 1 ? `… et ${n} autre` : `… et ${n} autres`),
  hideChecklist: 'Masquer',
  steps: {
    basics: {
      title: 'Bases',
      description:
        'Langue, nom, thème de couleurs et début de semaine. Tout peut être modifié plus tard.',
      name: 'Votre nom (facultatif)',
      nameHint: 'Uniquement pour les messages d’accueil, reste dans vos données.',
      weekStart: 'La semaine commence le',
      monday: 'Lundi',
      sunday: 'Dimanche',
      fixedTitle: 'Réglages fixes',
      timezone: (zone: string) => `Fuseau horaire : ${zone} (les heures restent l’heure locale)`,
      currency: 'Devise : euro (EUR), montants au format allemand',
    },
    sync: {
      title: 'Synchronisation et restauration',
      description: 'Choisissez si vos données restent sur cet appareil ou viennent d’ailleurs.',
      local: 'Sur cet appareil uniquement (par défaut)',
      localHint:
        'Rien n’est connecté. La synchronisation et la sauvegarde sont disponibles plus tard dans les paramètres.',
      backup: 'Importer un fichier de sauvegarde',
      connect: 'Se connecter à un serveur de synchronisation',
      connected: 'Cet appareil est déjà connecté à un serveur de synchronisation.',
      afterConnect:
        'Si le serveur fournit déjà des modules et des données, vous pouvez passer les étapes Profil et Données de départ.',
    },
    profiles: {
      title: 'Profil et modules',
      description:
        'Un profil présélectionne les modules et outils adaptés. Vous pouvez ensuite tout ajuster individuellement.',
      currentState:
        'L’état actuel reste tel quel jusqu’à ce que vous choisissiez un profil ou changiez quelque chose.',
      choose: 'Choisir un profil',
      modules: 'Modules',
      requires: (names: string) => `S’appuie sur : ${names}`,
      viaDependency: (names: string) => `Inclus automatiquement pour : ${names}`,
      diffTitle: 'Ce qui change',
      diffNone: 'Aucun changement.',
      willEnable: (names: string) => `Sera activé : ${names}`,
      willDisable: (names: string) => `Sera désactivé : ${names}`,
      keepData: 'Les données des modules désactivés sont conservées.',
      toolsOn: (names: string) => `Outils activés : ${names}`,
      toolsOff: (names: string) => `Outils désactivés : ${names}`,
      confirm: 'J’ai vérifié les changements et je souhaite les appliquer.',
    },
    tools: {
      title: 'Boîte à outils',
      description: 'Petits outils pour la barre d’outils. Activez ce dont vous avez besoin.',
      showDev: 'Afficher les outils de développement',
      up: (name: string) => `Monter ${name}`,
      down: (name: string) => `Descendre ${name}`,
      groups: { basis: 'Base', extra: 'Extras', dev: 'Développeur' },
    },
    ai: {
      title: 'Fournisseurs d’IA',
      description:
        'Facultatif. Sans fournisseur, la recherche locale reste entièrement utilisable. Seuls votre question et un court schéma sont envoyés à l’IA, jamais vos données.',
      existing: 'Déjà configurés',
      none: 'Aucun fournisseur configuré pour l’instant.',
      usable: 'prêt',
      incomplete: 'incomplet (clé manquante)',
      add: 'Ajouter un fournisseur',
      key: 'Clé API',
      keyHint: 'Stockée uniquement dans l’espace protégé de cet appareil, jamais synchronisée.',
      keyLink: 'Créer une clé chez le fournisseur',
      model: 'Modèle',
      limit: 'Limite quotidienne (requêtes, vide = aucune)',
      test: 'Tester la connexion',
      testing: 'Test en cours…',
      remove: 'Retirer',
      order: 'Ordre (fallback)',
      up: (name: string) => `Monter ${name}`,
      down: (name: string) => `Descendre ${name}`,
      mayTrain: 'Ce fournisseur peut utiliser les saisies pour améliorer ses modèles.',
      ollamaFound: 'Ollama tourne sur cet ordinateur.',
      ollamaAdd: 'Ajouter Ollama',
    },
    connectors: {
      title: 'Associer des comptes',
      description:
        'Facultatif. Les connexions ne font que lire, elles ne modifient rien chez le service. Les identifiants sont dans le trousseau de cet appareil.',
      scopes: 'Autorisations de cette connexion',
      scopeLine: (label: string, scopes: string) => `${label} : ${scopes}`,
      noScopes: 'aucune connexion requise',
      testingNote:
        'Si votre projet Google est en statut « Testing », la connexion expire après 7 jours. Passez-le à « En production ».',
      stepsNote: 'Étapes : docs/MANUAL-TESTS.md → « Google-Verbindung einrichten ».',
      none: 'Cette version ne propose aucune connexion.',
    },
    startdata: {
      title: 'Données de départ',
      description:
        'Saisissez vos premières entrées ou importez-les : par texte, fichier, modèle ou connexion. Avant d’enregistrer, vous voyez toujours un aperçu, et chaque import peut être annulé.',
      none: 'Les modules actifs ne proposent pas de données de départ.',
      handled: 'Déjà traité',
      hints: {
        finance: 'Comptes, catégories et soldes de départ.',
        reminders: 'Modèles pour le loyer, les assurances, les poubelles et plus encore.',
        people: 'Coller les anniversaires sous forme de liste.',
      } as Record<string, string>,
    },
    aiimport: {
      title: 'Import par IA',
      description:
        'Laissez une IA de votre choix préparer des données : vous copiez le schéma, elle fournit du JSON, vous voyez un aperçu.',
      none: 'Aucun module actif ne prend en charge l’import JSON.',
      hint: 'Seul le schéma est copié, jamais vos données. Le coffre-fort (Mots de passe) n’est jamais disponible ici.',
      desktop:
        'Sur ordinateur, il existe aussi l’interface locale (Paramètres → Interface locale).',
    },
    notifications: {
      title: 'Notifications',
      description:
        'Pour que les rappels, les échéances et les anniversaires vous parviennent, l’app a besoin de l’autorisation d’envoyer des notifications.',
      why: 'Sans autorisation, tout reste utilisable, vous ne recevez simplement pas de rappels. Vous pouvez changer d’avis à tout moment dans les paramètres.',
      allow: 'Autoriser les notifications',
      state: {
        granted: 'Autorisées.',
        denied: 'Refusées. L’étape reste dans la liste de contrôle.',
        default: 'Pas encore décidé.',
        unsupported: 'Non disponible sur cet appareil.',
      } as Record<string, string>,
      android:
        'Android : pour les rappels quand l’app est fermée, le système doit autoriser les alarmes exactes, et l’optimisation de la batterie ne doit pas limiter l’app. Ces deux réglages se trouvent dans les paramètres Android sous « Applications → Nemo ».',
    },
    backupupdates: {
      title: 'Sauvegarde et mises à jour',
      description: 'La sauvegarde de vos données et le canal de mise à jour.',
      backupNow: 'Enregistrer une sauvegarde maintenant',
      autoNote:
        'Vous configurerez les sauvegardes automatiques plus tard sous Paramètres → Sauvegarde (dans l’app Windows et Android). Avant chaque mise à jour, l’app crée aussi une copie de sauvegarde.',
      channel: 'Canal de mise à jour',
      stable: 'Stable',
      beta: 'Bêta',
      auto: 'Rechercher automatiquement les mises à jour',
      browser: 'Dans le navigateur, l’app se met à jour d’elle-même (rechargez la page).',
    },
    support: {
      title: 'Soutenir Nemo (facultatif)',
      description: 'Une courte information, sans aucune pression.',
      text: 'Nemo est gratuit, toutes les fonctions vous sont ouvertes. Si vous le souhaitez, vous pouvez soutenir librement le développement et recevoir des extras cosmétiques (badge de remerciement, thèmes de couleurs). Vous trouverez cela à tout moment sous Paramètres → À propos de Nemo → Soutien.',
      open: 'En savoir plus',
      hide: 'Ne plus afficher',
      hidden: 'C’est noté, ce message ne s’affichera plus.',
    },
    dashboard: {
      title: 'Vue d’ensemble',
      description: 'Quels widgets apparaissent et dans quel ordre. Glisser-déposer ou clavier.',
      empty: 'Les modules actifs n’ont pas de widgets.',
      hide: (title: string) => `Afficher ${title}`,
      drag: (title: string) => `Déplacer ${title}`,
      instructions: 'Espace pour saisir, flèches pour déplacer, Espace pour déposer.',
    },
  },
  profiles: {
    everyday: {
      name: 'Quotidien',
      description: 'Calendrier, tâches, rappels, courses, notes, anniversaires.',
    },
    finance: {
      name: 'Priorité finances',
      description:
        'Finances, budgets, abonnements, factures, contrats – plus calendrier et rappels.',
    },
    productive: {
      name: 'Productif',
      description: 'Tâches, notes, calendrier, enregistrés et signets.',
    },
    minimal: { name: 'Minimaliste', description: 'Calendrier et tâches uniquement.' },
  } as Record<string, { name: string; description: string }>,
};
