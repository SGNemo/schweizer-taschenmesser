import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Déménager depuis une autre appli',
  intro:
    'Récupère tes données de Google, Todoist, Notion, d’une appli bancaire et plus encore. Nemo reconnaît les fichiers et montre un aperçu avant d’ajouter quoi que ce soit ; chaque déménagement peut être annulé en entier. Rien ne quitte cet appareil.',
  choose: 'Choisir des fichiers',
  reading: (done: number, total: number) => `Lecture des fichiers … ${done} sur ${total}`,
  cancel: 'Annuler',
  parsing: 'Lecture des données …',
  detected: (apps: string) => `Reconnu : ${apps}`,
  unknown: 'Je ne reconnais pas l’appli d’origine de ces fichiers. Choisissez la source :',
  manual: 'Choisir une autre source',
  step: (i: number, n: number) => `Partie ${i} sur ${n}`,
  nothing: 'Rien de lisible n’a été trouvé dans les fichiers.',
  vaultHint:
    'Les mots de passe s’importent dans le coffre, après saisie du mot de passe maître. L’import CSV s’y ouvre.',
  openVault: 'Aller au coffre',
  paletteCommand: 'Importer depuis une autre appli …',
  start: 'Commencer le déménagement',
  back: 'Retour',
  privacy: 'Les fichiers sont lus uniquement sur cet appareil. Rien n’est envoyé.',
  whereTitle: 'D’où viens-tu ?',
  whereLead:
    'D’où viens-tu ? Choisis l’appli d’où viennent tes données. Nemo reconnaît le reste à partir des fichiers.',
  stepOf: (i: number, n: number) => `Étape ${i} sur ${n}`,
  steps: {
    label: 'Étapes',
    where: 'Origine',
    files: 'Fichiers',
    check: 'Vérifier',
  },
  origins: {
    google: {
      title: 'Google',
      how: 'Sur takeout.google.com, choisis Agenda, Contacts, Keep et Tasks puis télécharge le fichier ZIP. Tu peux choisir le ZIP tel quel.',
    },
    apple: {
      title: 'Apple (iPhone, Mac)',
      how: 'Calendrier : « Exporter » dans l’appli Calendrier (.ics). Contacts : exporter en vCard dans l’appli Contacts.',
    },
    microsoft: {
      title: 'Microsoft (Outlook, To Do)',
      how: 'Microsoft To Do n’a pas d’export propre : dans Outlook, « Exporter » → CSV → Tâches. Calendrier en .ics, contacts en vCard.',
    },
    todoist: {
      title: 'Todoist',
      how: 'Dans Todoist, télécharge la sauvegarde en ZIP (Paramètres → Sauvegardes) ou exporte un projet comme modèle CSV.',
    },
    ticktick: {
      title: 'TickTick',
      how: 'Dans TickTick, va dans Paramètres → Compte, « Générer une sauvegarde » et enregistre le fichier CSV.',
    },
    notion: {
      title: 'Notion',
      how: 'Dans Notion, choisis « Exporter » → « Markdown et CSV » et enregistre le fichier ZIP.',
    },
    evernote: { title: 'Evernote', how: 'Dans Evernote, exporte les carnets en fichier .enex.' },
    obsidian: {
      title: 'Obsidian, Markdown',
      how: 'Choisis les fichiers Markdown ou ton dossier Obsidian en ZIP.',
    },
    bank: {
      title: 'Banque, relevé',
      how: 'Dans la banque en ligne, télécharge les opérations en CSV, CAMT, OFX ou QIF.',
    },
    passwords: {
      title: 'Gestionnaire de mots de passe',
      how: 'Exporte Bitwarden, 1Password ou KeePass en CSV. L’import se fait ensuite dans le coffre-fort, avec ton mot de passe principal.',
    },
    browser: {
      title: 'Signets du navigateur',
      how: 'Exporte les signets en fichier HTML dans le navigateur (Chrome, Firefox, Edge, Safari, Brave).',
    },
    other: {
      title: 'Je ne sais pas',
      how: 'Choisis simplement les fichiers. Nemo reconnaît d’où ils viennent.',
    },
  },
  foundTitle: 'Reconnu',
  nothingTitle: 'Rien de reconnu',
  pickSource: 'Choisis toi-même la source :',
  certainty: {
    sure: 'reconnu avec certitude',
    likely: 'probable',
    maybe: 'peut-être',
  },
  why: {
    'vault-csv':
      'Les colonnes correspondent à un gestionnaire de mots de passe. Seules les lignes sont comptées ; l’import se fait dans le coffre-fort.',
    ticktick: 'En-tête d’une sauvegarde TickTick (List Name, Title, Kind).',
    todoist: 'Colonnes TYPE et CONTENT comme dans un export Todoist, un fichier par projet.',
    'google-tasks': 'Fichier de tâches de Google Takeout (« tasks#… »).',
    'outlook-tasks': 'Colonnes comme Objet et Échéance d’un export de tâches Outlook.',
    'google-keep': 'Notes Keep de Google Takeout (JSON).',
    'google-calendar': 'Fichier d’agenda au format iCalendar.',
    enex: 'Export Evernote (.enex).',
    notion: 'Noms de fichiers avec l’identifiant Notion (titre et 32 caractères).',
    opml: 'Liste OPML d’adresses de flux.',
    contacts: 'Fiches de contact au format vCard. Les contacts avec un anniversaire sont repris.',
    bookmarks: 'Fichier de signets tel que tout navigateur l’exporte.',
    obsidian: 'Fichiers Markdown ; avec un dossier .obsidian, sûrement d’Obsidian.',
    bank: 'Colonnes de date et de montant, ou un format bancaire (CAMT, OFX, QIF).',
  },
  units: {
    projects: (n: number) => n1(n, '1 projet', `${n} projets`),
    lists: (n: number) => n1(n, '1 liste', `${n} listes`),
    tasks: (n: number) => n1(n, '1 tâche', `${n} tâches`),
    notes: (n: number) => n1(n, '1 note', `${n} notes`),
    events: (n: number) => n1(n, '1 événement', `${n} événements`),
    contacts: (n: number) => n1(n, '1 contact', `${n} contacts`),
    bookmarks: (n: number) => n1(n, '1 signet', `${n} signets`),
    transactions: (n: number) => n1(n, '1 opération', `${n} opérations`),
    feeds: (n: number) => n1(n, '1 flux', `${n} flux`),
    entries: (n: number) => n1(n, '1 entrée', `${n} entrées`),
  },
  goesTo: (module: string) => `Destination : ${module}.`,
  openPreview: 'Ouvrir l’aperçu',
  runDone: (n: number) => n1(n, '1 entrée a été ajoutée.', `${n} entrées ont été ajoutées.`),
  runParts: 'Ajouté par domaine',
  runPart: (module: string, n: number) => `${module}: ${n}`,
  runUndoHint:
    '« Annuler tout le déménagement » reprend toutes les parties. Ce que tu as modifié depuis reste.',
  undoRun: 'Annuler tout le déménagement',
  undoRunShort: 'Annuler',
  recentTitle: 'Derniers déménagements',
  recentRun: (source: string, date: string) => `${source}, ${date}`,
  emptyTitle: 'Pas encore de déménagement',
  emptyText: 'Chaque déménagement apparaît ici. Tu pourras l’annuler en entier plus tard.',
  checklist: 'Liste de contrôle',
  checklistHint: 'Ce qui manque encore pour le déménagement, étape par étape.',
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (export Markdown et CSV)',
    opml: 'OPML (applis de flux et de podcasts)',
    obsidian: 'Obsidian ou dossier Markdown',
    'outlook-tasks': 'Microsoft To Do (CSV Outlook)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Agenda (.ics)',
    bank: 'Opérations bancaires (CSV, OFX, CAMT)',
    'vault-csv': 'Gestionnaire de mots de passe (Bitwarden, KeePass, 1Password)',
    ticktick: 'TickTick (sauvegarde CSV)',
    contacts: 'Contacts (vCard : Google, Apple, Outlook)',
    bookmarks: 'Signets du navigateur (HTML)',
  },
  reasons: {
    trashed: (n: number) =>
      n1(
        n,
        '1 entrée de la corbeille ou des archives a été ignorée.',
        `${n} entrées de la corbeille ou des archives ont été ignorées.`,
      ),
    empty: (n: number) =>
      n1(n, '1 entrée vide a été ignorée.', `${n} entrées vides ont été ignorées.`),
    unreadable: (n: number) =>
      n1(
        n,
        '1 fichier illisible ou d’une autre appli a été ignoré.',
        `${n} fichiers illisibles ou d’une autre appli ont été ignorés.`,
      ),
    attachment: (n: number) =>
      n1(
        n,
        '1 pièce jointe (image ou fichier) n’a pas été importée : les notes ne gardent que du texte.',
        `${n} pièces jointes (images ou fichiers) n’ont pas été importées : les notes ne gardent que du texte.`,
      ),
    unsupported: (n: number) =>
      n1(n, '1 entrée n’est pas prise en charge.', `${n} entrées ne sont pas prises en charge.`),
    tooMany: (n: number) => `L’aperçu montre au plus ${n} entrées ; le reste a été ignoré.`,
    done: (n: number) =>
      n1(n, '1 entrée terminée a été ignorée.', `${n} entrées terminées ont été ignorées.`),
  },
  report: {
    title: 'Rapport',
    imported: (n: number) => n1(n, '1 entrée importée.', `${n} entrées importées.`),
    duplicates: (n: number) => n1(n, '1 existait déjà.', `${n} existaient déjà.`),
    invalid: (n: number) =>
      n1(
        n,
        '1 ne correspondait pas au format et n’a pas été enregistrée.',
        `${n} ne correspondaient pas au format et n’ont pas été enregistrées.`,
      ),
    deselected: (n: number) => n1(n, 'Vous en avez décoché 1.', `Vous en avez décoché ${n}.`),
  },
  newNotebook: 'Nouveau carnet',
};
