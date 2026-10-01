/**
 * RSS 2.0, RSS 1.0 (RDF) and Atom feeds as plain, safe data: every text is reduced to plain text (no
 * markup survives), only http(s) links are kept, sizes are capped. Pure; uses `DOMParser`.
 */

export interface FeedItem {
  /** Stable id of the entry inside the feed. */
  guid: string;
  title: string;
  /** Plain-text teaser, ≤ 300 characters. */
  teaser: string;
  /** http(s) link to the full article. */
  url?: string;
  /** Epoch ms; never in the future. */
  publishedAt: number;
}

export interface ParsedFeed {
  title: string;
  items: FeedItem[];
}

export class FeedFormatError extends Error {
  constructor() {
    super('not-a-feed');
  }
}

export const MAX_ITEMS = 200;
const TEASER_LENGTH = 300;
const TITLE_LENGTH = 200;

/** Normalize plain text and cap length without interpreting input as HTML. */
export function plainText(text: string, limit: number): string {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  const cut = normalized.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()} …`;
}

export function safeHttpUrl(value: string | null | undefined, base?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim(), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    return url.toString().length <= 2048 ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const kids = (el: Element, name: string): Element[] =>
  Array.from(el.children).filter((c) => c.localName === name);
const first = (el: Element, name: string): Element | undefined => kids(el, name)[0];
const textOf = (el: Element | undefined): string => el?.textContent?.trim() ?? '';

function when(value: string, now: number): number {
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.min(t, now) : now;
}

/** Cheap 32-bit hash for entries without any id. */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function finish(
  title: string,
  raw: { guid: string; title: string; summary: string; link?: string; date: string }[],
  now: number,
  base?: string,
): ParsedFeed {
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const r of raw) {
    const itemTitle = plainText(r.title, TITLE_LENGTH);
    if (!itemTitle) continue;
    const url = safeHttpUrl(r.link, base);
    const publishedAt = when(r.date, now);
    const guid = (r.guid || url || `${hash(itemTitle)}-${publishedAt}`).slice(0, 512);
    if (seen.has(guid)) continue;
    seen.add(guid);
    items.push({
      guid,
      title: itemTitle,
      teaser: plainText(r.summary, TEASER_LENGTH),
      url,
      publishedAt,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return { title: plainText(title, TITLE_LENGTH), items };
}

export function parseFeed(xml: string, now: number, feedUrl?: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ''), 'application/xml');
  const root = doc.documentElement;
  if (!root || doc.getElementsByTagName('parsererror').length > 0) throw new FeedFormatError();

  if (root.localName === 'rss') {
    const channel = first(root, 'channel');
    if (!channel) throw new FeedFormatError();
    return finish(
      textOf(first(channel, 'title')),
      kids(channel, 'item').map((item) => ({
        guid: textOf(first(item, 'guid')),
        title: textOf(first(item, 'title')),
        summary: textOf(first(item, 'description')),
        link: textOf(first(item, 'link')),
        date: textOf(first(item, 'pubDate')) || textOf(first(item, 'date')),
      })),
      now,
      feedUrl,
    );
  }

  if (root.localName === 'RDF') {
    const channel = first(root, 'channel');
    return finish(
      textOf(channel && first(channel, 'title')),
      kids(root, 'item').map((item) => ({
        guid:
          item.getAttribute('rdf:about') ??
          item.getAttributeNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'about') ??
          '',
        title: textOf(first(item, 'title')),
        summary: textOf(first(item, 'description')),
        link: textOf(first(item, 'link')),
        date: textOf(first(item, 'date')),
      })),
      now,
      feedUrl,
    );
  }

  if (root.localName === 'feed') {
    return finish(
      textOf(first(root, 'title')),
      kids(root, 'entry').map((entry) => {
        const links = kids(entry, 'link');
        const alternate = links.find(
          (l) => !l.getAttribute('rel') || l.getAttribute('rel') === 'alternate',
        );
        return {
          guid: textOf(first(entry, 'id')),
          title: textOf(first(entry, 'title')),
          summary: textOf(first(entry, 'summary')) || textOf(first(entry, 'content')),
          link: alternate?.getAttribute('href') ?? '',
          date: textOf(first(entry, 'published')) || textOf(first(entry, 'updated')),
        };
      }),
      now,
      feedUrl,
    );
  }
  throw new FeedFormatError();
}
