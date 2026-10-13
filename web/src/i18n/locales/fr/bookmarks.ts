import type { Strings } from '@/strings';

export const bookmarks: Strings['bookmarks'] = {
  meta: {
    name: 'Enregistrés',
    description:
      'Garder liens, lectures, films, lieux et idées – avec tags, filtres et statut terminé ; les liens fréquents en tuiles de signets. Sur mobile aussi via « Partager » depuis d’autres apps.',
    route: 'Enregistrés',
    widget: 'Enregistrés',
    widgetLinks: 'Signets',
    quickAdd: 'Enregistré',
  },
  title: 'Enregistrés',
  add: 'Enregistrer',
  edit: 'Modifier l’élément enregistré',
  url: 'Adresse (lien)',
  urlInvalid: 'Veuillez saisir une adresse http(s) valide.',
  kind: 'Type',
  kinds: {
    link: 'Lien',
    read: 'À lire',
    watch: 'À voir',
    place: 'Lieu',
    idea: 'Idée',
    other: 'Autre',
  } as Record<string, string>,
  allKinds: 'Tous les types',
  tags: 'Tags',
  tagsHint: 'Séparer par des virgules, par ex. recette, vacances',
  filterTags: 'Filtrer par tag',
  search: 'Rechercher dans les enregistrés',
  view: 'Statut',
  views: { open: 'Ouverts', done: 'Terminés', all: 'Tous' },
  tabsLabel: 'Vue',
  tabList: 'Enregistrés',
  tabLinks: 'Signets',
  addLink: 'Ajouter un signet',
  linksWidgetEmpty: 'Aucun signet pour l’instant.',
  noGroup: 'Sans groupe',
  linksEmpty:
    'Aucun signet pour l’instant. Ajoutez les liens dont vous avez souvent besoin – regroupés par leur premier tag.',
  empty: 'Rien d’enregistré pour l’instant.',
  emptyFiltered: 'Aucun résultat.',
  open: 'Ouvrir le lien',
  done: 'Terminé',
  widgetEmpty: 'Rien d’enregistré.',
  openCount: (n: number) =>
    n <= 1 ? `${n} élément enregistré ouvert` : `${n} éléments enregistrés ouverts`,
};
