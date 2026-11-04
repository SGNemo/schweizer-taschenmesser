import type { Strings } from '@/strings';

const n1 = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const importers: Strings['importers'] = {
  title: 'Importer depuis une autre appli',
  intro:
    'Choisissez le ou les fichiers de votre export, ZIP compris. Nemo reconnaît de quelle appli ils viennent et affiche un aperçu avant d’ajouter quoi que ce soit. Rien ne quitte cet appareil.',
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
  sources: {
    enex: 'Evernote (.enex)',
    notion: 'Notion (export Markdown et CSV)',
    obsidian: 'Obsidian ou dossier Markdown',
    'outlook-tasks': 'Microsoft To Do (CSV Outlook)',
    todoist: 'Todoist (CSV)',
    'google-tasks': 'Google Tasks',
    'google-keep': 'Google Keep',
    'google-calendar': 'Google Agenda (.ics)',
    bank: 'Opérations bancaires (CSV, OFX, CAMT)',
    'vault-csv': 'Gestionnaire de mots de passe (Bitwarden, KeePass, 1Password)',
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
