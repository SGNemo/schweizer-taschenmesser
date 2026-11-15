import { FeedFormatError, parseFeed, safeHttpUrl, type FeedItem } from '@/core/io/feed';
import { fetchPublic, PublicFetchError } from '@/core/net/fetchPublic';
import { now } from '@/core/time/now';

/** A feed a page names in its head. */
export interface FeedLink {
  url: string;
  title: string;
}

const FEED_TYPES = new Set([
  'application/rss+xml',
  'application/atom+xml',
  'application/rdf+xml',
  'application/xml',
  'text/xml',
]);

/** At most this many feeds of one page are offered (a news site lists one per section). */
export const MAX_LINKS = 12;
/** Articles the preview shows. */
export const PREVIEW_ITEMS = 5;

/**
 * The feeds a web page announces with `<link rel="alternate" type="application/rss+xml" href="…">`
 * (also Atom and RDF). The page is parsed in an inert document; only http(s) addresses survive,
 * relative ones are resolved against the page, doubles and comment feeds are dropped.
 */
export function discoverFeedLinks(html: string, pageUrl: string): FeedLink[] {
  const doc = new DOMParser().parseFromString(html.slice(0, 1024 * 1024), 'text/html');
  const base = safeHttpUrl(doc.querySelector('base[href]')?.getAttribute('href'), pageUrl);
  const out: FeedLink[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(doc.querySelectorAll('link[rel][href]'))) {
    const rel = (el.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
    const type = (el.getAttribute('type') ?? '').toLowerCase().split(';')[0]!.trim();
    if (!rel.includes('alternate') || !FEED_TYPES.has(type)) continue;
    const url = safeHttpUrl(el.getAttribute('href'), base ?? pageUrl);
    if (!url || seen.has(url)) continue;
    const title = (el.getAttribute('title') ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    // WordPress and others list a comment feed next to the posts; nobody subscribes to that.
    if (/comment|kommentar/i.test(`${title} ${new URL(url).pathname}`) && out.length > 0) continue;
    seen.add(url);
    out.push({ url, title });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

export interface FeedPreview {
  /** The feed address that was read (may differ from what was typed). */
  url: string;
  title: string;
  items: FeedItem[];
}

export type LookUpResult =
  | { kind: 'feed'; feed: FeedPreview }
  | { kind: 'choices'; links: FeedLink[] }
  | { kind: 'none' }
  | { kind: 'error'; reason: 'no-proxy' | 'network' };

type Fetcher = typeof fetchPublic;

async function readFeed(url: string, fetcher: Fetcher): Promise<FeedPreview | 'not-feed'> {
  const res = await fetcher(url, undefined, undefined, 'feed');
  if (!res.ok) return 'not-feed';
  try {
    const parsed = parseFeed(await res.text(), now(), url);
    return {
      url,
      title: parsed.title,
      items: [...parsed.items]
        .sort((a, b) => b.publishedAt - a.publishedAt)
        .slice(0, PREVIEW_ITEMS),
    };
  } catch (e) {
    if (e instanceof FeedFormatError) return 'not-feed';
    throw e;
  }
}

/**
 * What is behind an address, on one click: a feed (with its latest articles), the feeds a website
 * names, or nothing. At most three requests: the address as a feed, the address as a page, and the
 * one feed the page names. Nothing is stored here.
 */
export async function lookUp(url: string, fetcher: Fetcher = fetchPublic): Promise<LookUpResult> {
  try {
    const direct = await readFeed(url, fetcher);
    if (direct !== 'not-feed') return { kind: 'feed', feed: direct };
    const page = await fetcher(url, undefined, undefined, 'page');
    if (!page.ok) return { kind: 'none' };
    const links = discoverFeedLinks(await page.text(), url);
    if (links.length === 0) return { kind: 'none' };
    if (links.length > 1) return { kind: 'choices', links };
    const only = await readFeed(links[0]!.url, fetcher);
    return only === 'not-feed' ? { kind: 'none' } : { kind: 'feed', feed: only };
  } catch (e) {
    return {
      kind: 'error',
      reason: e instanceof PublicFetchError && e.code === 'no-proxy' ? 'no-proxy' : 'network',
    };
  }
}
