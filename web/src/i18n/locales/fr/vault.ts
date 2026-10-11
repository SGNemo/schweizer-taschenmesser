import type { Strings } from '@/strings';

export const vault: Strings['vault'] = {
  meta: {
    name: 'Documents',
    description:
      'Pièces d’identité, contrats, assurances et garanties avec échéance, délai de résiliation et fichier joint – au calendrier et avec un rappel avant qu’un délai expire. Les fichiers restent uniquement sur cet appareil.',
    route: 'Documents',
    widget: 'Délais et échéances',
    quickAdd: 'Document',
    settings: {
      remindDaysBefore: 'Rappel avant l’échéance (jours)',
      remindDaysBeforeDeadline: 'Rappel avant le délai de résiliation (jours)',
      remindTime: 'Heure du rappel',
      remindTimeHelp: 'Au format HH:mm',
    },
  },
  title: 'Documents',
  add: 'Ajouter un document',
  edit: 'Modifier le document',
  category: 'Catégorie',
  allCategories: 'Toutes',
  categories: {
    identity: 'Pièces d’identité',
    insurance: 'Assurance',
    contract: 'Contrats',
    warranty: 'Garanties',
    tax: 'Impôts',
    health: 'Santé',
    other: 'Autres',
  } as Record<string, string>,
  provider: 'Fournisseur',
  startDate: 'Début',
  endDate: 'Fin / échéance',
  noticeDays: 'Délai de résiliation (jours avant la fin)',
  noticeHint: 'Laissez vide s’il n’y a pas de délai (par ex. pièces d’identité ou garanties).',
  invalid: 'Veuillez vérifier les données (la fin ne peut pas précéder le début).',
  endLabel: 'Fin',
  deadlineLabel: 'Résilier avant le',
  endsOn: (title: string, category: string) =>
    category === 'warranty'
      ? `Fin de garantie : ${title}`
      : category === 'contract' || category === 'insurance'
        ? `Fin de contrat : ${title}`
        : `Expire : ${title}`,
  cancelBy: (title: string) => `Délai de résiliation : ${title}`,
  remindBody: (date: string) => `Le ${date.split('-').reverse().join('/')}`,
  file: 'Fichier',
  localOnly:
    'Les fichiers restent uniquement sur cet appareil : ils ne sont ni synchronisés ni inclus dans la sauvegarde. Le titre, la date d’échéance et les notes sont synchronisés comme d’habitude.',
  fileElsewhere: 'Fichier uniquement sur un autre appareil',
  removeFile: 'Retirer le fichier',
  tooLarge: (max: string) => `Le fichier est trop volumineux (${max} au maximum).`,
  download: 'Télécharger',
  search: 'Rechercher des documents',
  status: {
    expired: 'Expiré',
    'act-now': 'Résilier maintenant',
    soon: 'Bientôt',
    ok: '',
    'open-ended': '',
  } as Record<string, string>,
  empty: 'Aucun document pour l’instant.',
  emptyFiltered: 'Aucun résultat.',
  widgetEmpty: 'Aucun délai en vue.',
};
