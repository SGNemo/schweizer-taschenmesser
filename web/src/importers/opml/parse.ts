/**
 * OPML, the subscription list podcast and feed apps export (`<outline xmlUrl="…" text="…">`, usually
 * grouped in folder outlines). Scanned with a small tag tokenizer – no `DOMParser`, so it runs in a
 * Worker. A feed outline has `xmlUrl`; an outline without one is a folder whose `text` becomes the
 * group of the feeds inside. Only http(s) addresses are taken.
 */
import { decodeEntities } from '../enex/enml';
import { addSkip, type SkipCounts } from '../types';

export interface OpmlFeed {
  title: string;
  url: string;
  siteUrl?: string;
  /** Name of the enclosing folder outline (deepest one wins); empty = none. */
  category: string;
}

export interface OpmlResult {
  feeds: OpmlFeed[];
  skipped: SkipCounts;
  /** The text is not OPML at all. */
  invalid: boolean;
}

export const looksLikeOpml = (text: string): boolean => /<opml[\s>]/i.test(text.slice(0, 4000));

function attrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of raw.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? '');
  return out;
}

const web = (u: string | undefined): string | undefined =>
  u && /^https?:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : undefined;

export function parseOpml(text: string): OpmlResult {
  const src = text.replace(/^\uFEFF/, '');
  const result: OpmlResult = { feeds: [], skipped: {}, invalid: false };
  if (!looksLikeOpml(src)) return { ...result, invalid: true };
  const folders: string[] = [];
  const tag = /<(\/?)outline\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/gi;
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    const [, closing, raw, selfClosing] = m;
    if (closing) {
      folders.pop();
      continue;
    }
    const a = attrs(raw!);
    const name = (a.text || a.title || '').trim();
    const xml = a.xmlurl;
    if (xml === undefined) {
      // A folder (or an outline of another kind that holds feeds).
      if (!selfClosing) folders.push(name);
      continue;
    }
    const url = web(xml);
    if (!url) {
      addSkip(result.skipped, 'unsupported');
    } else {
      const site = web(a.htmlurl);
      result.feeds.push({
        title: name,
        url,
        ...(site ? { siteUrl: site } : {}),
        category: [...folders].reverse().find(Boolean) ?? '',
      });
    }
    // An outline with xmlUrl can still hold children (rare); they stay in its folder level.
    if (!selfClosing) folders.push('');
  }
  return result;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** OPML 2.0 with one folder outline per group; ungrouped feeds sit directly under `body`. */
export function buildOpml(
  feeds: readonly { title: string; url: string; siteUrl?: string; category: string }[],
  title: string,
): string {
  const line = (f: (typeof feeds)[number], indent: string) =>
    `${indent}<outline type="rss" text="${esc(f.title)}" title="${esc(f.title)}" xmlUrl="${esc(f.url)}"${
      f.siteUrl ? ` htmlUrl="${esc(f.siteUrl)}"` : ''
    }/>`;
  const groups = new Map<string, (typeof feeds)[number][]>();
  for (const f of feeds) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  const body: string[] = [];
  for (const [category, list] of groups) {
    if (category === '') continue;
    body.push(`    <outline text="${esc(category)}" title="${esc(category)}">`);
    for (const f of list) body.push(line(f, '      '));
    body.push('    </outline>');
  }
  for (const f of groups.get('') ?? []) body.push(line(f, '    '));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    `  <head><title>${esc(title)}</title></head>`,
    '  <body>',
    ...body,
    '  </body>',
    '</opml>',
    '',
  ].join('\n');
}
