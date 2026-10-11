import type { Strings } from '@/strings';

export const backup: Strings['backup'] = {
  deletedCount: (n: number) => ` (+${n} ${n <= 1 ? 'supprimée' : 'supprimées'})`,
  title: 'Sauvegarde',
  intro:
    'Enregistrez toutes vos données dans un fichier ou restaurez une sauvegarde. Les identifiants (token de synchronisation, clés) ne sont jamais inclus dans la sauvegarde.',
  export: 'Télécharger la sauvegarde',
  exported: 'Sauvegarde téléchargée.',
  file: 'Fichier de sauvegarde',
  mode: 'Restauration',
  merge: 'Fusionner',
  mergeHint: 'Rien n’est perdu ; en cas de conflit, la modification la plus récente l’emporte.',
  replace: 'Remplacer',
  replaceHint:
    'La sauvegarde devient l’état actuel : les entrées absentes de la sauvegarde sont supprimées.',
  doImport: 'Importer',
  contains: (records: number, tables: number) =>
    `${records} ${records <= 1 ? 'entrée' : 'entrées'} dans ${tables} ${tables <= 1 ? 'table' : 'tables'}`,
  confirmTitle: 'Remplacer par la sauvegarde ?',
  confirmText:
    'Toutes les entrées absentes de la sauvegarde seront supprimées – y compris sur les autres appareils dès qu’ils se synchronisent.',
  done: (records: number, removed: number) =>
    removed > 0
      ? `${records} ${records <= 1 ? 'entrée restaurée' : 'entrées restaurées'}, ${removed} ${removed <= 1 ? 'supprimée' : 'supprimées'}.`
      : `${records} ${records <= 1 ? 'entrée restaurée' : 'entrées restaurées'}.`,
  encryptedExport: 'Exporter chiffré',
  encryptedExported: 'Sauvegarde chiffrée téléchargée.',
  exportHint:
    'Recommandé : exporter chiffré (Argon2id, AES-256). La sauvegarde normale contient toutes les entrées en clair.',
  exportPassphrase: 'Mot de passe de la sauvegarde',
  exportPassphraseHint:
    'Au moins 8 caractères. Sans ce mot de passe, la sauvegarde ne peut pas être ouverte – aucune réinitialisation n’est possible.',
  passphraseTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
  openPassphrase: 'Mot de passe de la sauvegarde',
  unlock: 'Ouvrir',
  verify: 'Vérifier la sauvegarde',
  verifyHint:
    'Vérifie le fichier et le restaure à titre d’essai dans une base de données temporaire. Vos données restent intactes.',
  verifying: 'Vérification…',
  verifyOk: 'La sauvegarde est en bon état et peut être restaurée.',
  verifyFailed: 'La sauvegarde n’est pas en bon état.',
  verifyExported: (when: string) => `Créée le ${when}`,
  verifyTotals: (records: number, tombstones: number) =>
    `${records} ${records <= 1 ? 'entrée' : 'entrées'}, ${tombstones} ${tombstones <= 1 ? 'marque de suppression' : 'marques de suppression'}`,
  skippedOnRestore: (n: number) =>
    n <= 1
      ? `${n} table du fichier n’est plus connue de cette version de l’app (p. ex. d’anciens modules comme Courses, Listes de bagages ou Habitudes) et ne sera pas restaurée.`
      : `${n} tables du fichier ne sont plus connues de cette version de l’app (p. ex. d’anciens modules comme Courses, Listes de bagages ou Habitudes) et ne seront pas restaurées.`,
  verifySkipped: (n: number) =>
    n <= 1
      ? `${n} table provient d’une autre version de l’app et sera ignorée.`
      : `${n} tables proviennent d’une autre version de l’app et seront ignorées.`,
  steps: {
    format: 'Format du fichier',
    checksum: 'Somme de contrôle (SHA-256)',
    decrypt: 'Déchiffrement',
    structure: 'Contenu valide',
    restore: 'Restauration d’essai',
    counts: 'Nombre par module correct',
  } as Record<string, string>,
  stepStatus: { ok: 'ok', failed: 'Erreur', skipped: '–' } as Record<string, string>,
  core: 'Paramètres',
  previewTitle: 'Voici ce qui se passe lors de la restauration',
  previewRow: (module: string, added: number, replaced: number, removed: number) =>
    `${module} : ${added} ${added <= 1 ? 'nouvelle' : 'nouvelles'}, ${replaced} ${replaced <= 1 ? 'remplacée' : 'remplacées'}${removed > 0 ? `, ${removed} ${removed <= 1 ? 'supprimée' : 'supprimées'}` : ''}`,
  previewTotals: (added: number, replaced: number, removed: number) =>
    `Total : ${added} ${added <= 1 ? 'ajoutée' : 'ajoutées'}, ${replaced} ${replaced <= 1 ? 'remplacée' : 'remplacées'}, ${removed} ${removed <= 1 ? 'supprimée' : 'supprimées'}.`,
  previewNothing: 'Rien ne change.',
  safetyNote:
    'Avant cela, l’app crée automatiquement une copie de sécurité de vos données actuelles. En cas d’interruption, rien n’est modifié.',
  restoring: 'Restauration…',
  autoTitle: 'Sauvegardes automatiques',
  autoIntro:
    'L’app sauvegarde régulièrement vos données, chiffrées, dans son dossier de données et conserve les copies les plus récentes. Le mot de passe est stocké dans le trousseau de l’appareil.',
  autoUnsupported:
    'Les sauvegardes automatiques ne sont disponibles que dans l’app installée (Windows, Android).',
  autoEnable: 'Sauvegarder automatiquement',
  autoInterval: 'Fréquence',
  autoDaily: 'Quotidienne',
  autoWeekly: 'Hebdomadaire',
  autoKeep: 'Nombre de copies',
  autoPassphrase: 'Mot de passe des sauvegardes automatiques',
  autoPassphraseSet: 'Mot de passe enregistré. Saisissez-en un nouveau pour le remplacer.',
  autoPassphraseHint:
    'Au moins 8 caractères. Notez-le : sans ce mot de passe, les copies ne peuvent pas être ouvertes.',
  autoSavePassphrase: 'Enregistrer le mot de passe',
  autoRunNow: 'Sauvegarder maintenant',
  autoLast: 'Dernière sauvegarde',
  autoNever: 'aucune pour l’instant',
  autoLastFailed: 'La dernière sauvegarde a échoué.',
  autoNeedPassphrase: 'Définissez d’abord un mot de passe.',
  autoCreated: 'Sauvegarde créée.',
  autoFiles: 'Copies disponibles',
  autoNoFiles: 'Aucune copie pour l’instant.',
  autoUse: 'Ouvrir',
  autoSaveAs: 'Enregistrer sous…',
  errors: {
    'not-json': 'Ce fichier n’est pas un fichier JSON valide.',
    'wrong-format': 'Ce n’est pas un fichier de sauvegarde Nemo.',
    'newer-version': 'Cette sauvegarde provient d’une version plus récente de l’app.',
    invalid: 'Le fichier de sauvegarde est endommagé.',
    'passphrase-required': 'Cette sauvegarde est chiffrée. Saisissez le mot de passe.',
    'wrong-passphrase': 'Mot de passe incorrect – ou le fichier a été modifié.',
    'checksum-mismatch':
      'La somme de contrôle ne correspond pas : le fichier est endommagé ou incomplet.',
    'restore-failed': 'La restauration d’essai a échoué.',
    'count-mismatch': 'Des entrées manquent après la restauration d’essai.',
    'safety-failed': 'La copie de sécurité n’a pas pu être créée. Rien n’a été modifié.',
    'safety-cancelled': 'Pas de restauration sans copie de sécurité. Rien n’a été modifié.',
    'restore-error': 'La restauration a échoué. Rien n’a été modifié.',
  } as Record<string, string>,
};
