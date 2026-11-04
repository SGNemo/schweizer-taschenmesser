import type { Strings } from '@/strings';

export const feeds: Strings['feeds'] = {
  meta: {
    name: 'Flux',
    description:
      'Vos flux suivis (actualités, blogs, podcasts) au même endroit, classés par groupe. Nemo ne les récupère pas lui-même ; un appui ouvre le site.',
    quickAdd: 'Ajouter un flux',
    settings: {
      grouped: 'Classer par groupes',
      groupedHelp:
        'Affiche les flux sous le nom de leur groupe ; désactivé : une liste alphabétique.',
    },
  },
  title: 'Flux',
  add: 'Ajouter un flux',
  edit: 'Modifier le flux',
  remove: 'Retirer',
  empty: 'Aucun flux pour l’instant',
  emptyHint: 'Saisissez l’adresse d’un flux, par exemple celui de votre blog préféré.',
  listLabel: 'Flux suivis',
  ungrouped: 'Sans groupe',
  allFeeds: 'Tous les flux',
  lead: 'Ajouté en dernier',
  groupsCount: (g: number) => (g === 0 ? '' : g === 1 ? '1 groupe' : `${g} groupes`),
  importOpml: 'Importer',
  exportOpml: 'Exporter en OPML',
  exported: 'OPML enregistré.',
  opmlTitle: 'Mes flux',
  rowMenu: (name: string) => `Actions pour ${name}`,
  fields: {
    url: 'Adresse du flux',
    urlHint: 'Par exemple example.org/feed.xml',
    title: 'Nom',
    titleHint: 'Laissez vide : Nemo prend le nom du site.',
    category: 'Groupe',
  },
  errors: {
    url: 'Ce n’est pas une adresse web (http ou https).',
    duplicate: 'Vous avez déjà ce flux.',
  },
  widget: {
    label: 'Flux',
    context: (n: number, g: number) =>
      `${n === 1 ? '1 flux' : `${n} flux`}${g > 0 ? ` · ${g === 1 ? '1 groupe' : `${g} groupes`}` : ''}`,
    empty: 'Aucun flux pour l’instant',
    add: 'Ajouter un flux',
  },
};
