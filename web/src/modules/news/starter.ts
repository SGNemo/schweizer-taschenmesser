import type { Category } from './schema';

export interface StarterFeed {
  id: string;
  title: string;
  url: string;
  category: Category;
}

/**
 * Suggested feeds. The addresses come from memory of the publishers' feed pages and could not be
 * checked from the build environment – they are only suggestions the user confirms in the preview,
 * and a feed that does not load says so in "Feeds verwalten".
 */
export const STARTER_FEEDS: readonly StarterFeed[] = [
  {
    id: 'tagesschau',
    title: 'tagesschau',
    url: 'https://www.tagesschau.de/index~rss2.xml',
    category: 'nachrichten',
  },
  {
    id: 'zdfheute',
    title: 'ZDFheute Nachrichten',
    url: 'https://www.zdf.de/rss/zdf/nachrichten',
    category: 'nachrichten',
  },
  {
    id: 'dw',
    title: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-de-all',
    category: 'nachrichten',
  },
  {
    id: 'heise',
    title: 'heise online',
    url: 'https://www.heise.de/rss/heise-atom.xml',
    category: 'technik',
  },
  {
    id: 'golem',
    title: 'Golem.de',
    url: 'https://rss.golem.de/rss.php?feed=RSS2.0',
    category: 'technik',
  },
  {
    id: 'ars',
    title: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'technik',
  },
  {
    id: 'spektrum',
    title: 'Spektrum der Wissenschaft',
    url: 'https://www.spektrum.de/alias/rss/spektrum-de-rss-feed/996406',
    category: 'wissenschaft',
  },
  {
    id: 'tagesschau-wissen',
    title: 'tagesschau Wissen',
    url: 'https://www.tagesschau.de/wissen/index~rss2.xml',
    category: 'wissenschaft',
  },
  {
    id: 'tagesschau-klima',
    title: 'tagesschau Klima & Umwelt',
    url: 'https://www.tagesschau.de/wissen/klima/index~rss2.xml',
    category: 'natur',
  },
];
