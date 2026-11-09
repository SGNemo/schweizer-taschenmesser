import type { Strings } from '@/strings';

export const feeds: Strings['feeds'] = {
  meta: {
    name: 'Feeds',
    description:
      'Your subscribed feeds (news, blogs, podcasts) in one place, sorted by group. Nemo does not fetch them itself; a tap opens the site.',
    quickAdd: 'Add feed',
    settings: {
      grouped: 'Sort into groups',
      groupedHelp: 'Shows the feeds under their group names; off: one alphabetical list.',
    },
  },
  title: 'Feeds',
  add: 'Add feed',
  edit: 'Edit feed',
  remove: 'Remove',
  empty: 'No feeds yet',
  emptyHint: 'Enter the address of a feed, for example from your favourite blog.',
  listLabel: 'Subscribed feeds',
  ungrouped: 'No group',
  allFeeds: 'All feeds',
  lead: 'Added last',
  groupsCount: (g: number) => (g === 0 ? '' : g === 1 ? '1 group' : `${g} groups`),
  importOpml: 'Import',
  exportOpml: 'Export as OPML',
  exported: 'OPML saved.',
  opmlTitle: 'My feeds',
  rowMenu: (name: string) => `Actions for ${name}`,
  fields: {
    url: 'Feed address',
    urlHint: 'For example example.org/feed.xml',
    title: 'Name',
    titleHint: 'Leave empty: Nemo uses the name of the website.',
    category: 'Group',
  },
  errors: {
    url: 'That is not a web address (http or https).',
    duplicate: 'You already have this feed.',
  },
  widget: {
    label: 'Feeds',
    context: (_n: number, g: number) =>
      g === 0 ? 'no groups' : g === 1 ? 'in 1 group' : `in ${g} groups`,
    empty: 'No feeds yet',
    add: 'Add feed',
  },
};
