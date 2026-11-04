/**
 * Pure parts of `npm run check:doclinks` (scripts/check-doc-links.mjs): what a Markdown file links to,
 * which anchors it offers, whether its pictures have alt texts and whether its headings skip a level.
 */

export interface Link {
  /** The target as written. */
  target: string;
  /** `link` = a page or file, `image` = a picture source. */
  kind: 'link' | 'image';
}

const stripFences = (text: string) => text.replace(/```[\s\S]*?```/g, '');
const stripCode = (text: string) => stripFences(text).replace(/`[^`\n]*`/g, '');

/** Every link and picture source of a Markdown/HTML file (code blocks and inline code ignored). */
export function extractLinks(text: string): Link[] {
  const body = stripCode(text);
  const out: Link[] = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g))
    out.push({ target: m[1], kind: 'image' });
  for (const m of body.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)[^)]*\)/g))
    out.push({ target: m[1], kind: 'link' });
  for (const m of body.matchAll(/<a\s[^>]*href="([^"]+)"/g))
    out.push({ target: m[1], kind: 'link' });
  for (const m of body.matchAll(/<(?:img|source)\s[^>]*?(?:src|srcset)="([^"]+)"/g))
    out.push({ target: m[1], kind: 'image' });
  return out;
}

/** GitHub's anchor for a heading: lower case, no punctuation, spaces to hyphens. */
export function slug(heading: string): string {
  return heading
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** Anchors a Markdown file offers: its headings (with GitHub's `-1` suffix for repeats) and HTML ids. */
export function anchors(text: string): Set<string> {
  const body = stripFences(text);
  const seen = new Map<string, number>();
  const out = new Set<string>();
  const add = (heading: string) => {
    const base = slug(heading);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  };
  for (const line of body.split('\n')) {
    const md = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (md) add(md[1]);
    for (const h of line.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g)) add(h[1]);
  }
  for (const m of body.matchAll(/\sid="([^"]+)"/g)) out.add(m[1]);
  return out;
}

/** `<img>` and Markdown pictures without a descriptive alt text (empty or missing). */
export function imagesWithoutAlt(text: string): string[] {
  const body = stripCode(text);
  const bad: string[] = [];
  for (const m of body.matchAll(/<img\s[^>]*>/g)) {
    const alt = /\balt="([^"]*)"/.exec(m[0]);
    const src = /\bsrc="([^"]*)"/.exec(m[0])?.[1] ?? m[0];
    if (!alt || alt[1].trim() === '') bad.push(src);
  }
  for (const m of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
    if (m[1].trim() === '') bad.push(m[2]);
  }
  return bad;
}

/** Heading levels (Markdown `#` and HTML `<h1>`–`<h6>`) in order; a jump down by more than one is a skip. */
export function headingSkips(text: string): string[] {
  const body = stripCode(text);
  const levels: { level: number; label: string }[] = [];
  for (const line of body.split('\n')) {
    const md = /^(#{1,6})\s+(.*)$/.exec(line);
    if (md) levels.push({ level: md[1].length, label: md[2].trim() });
    for (const h of line.matchAll(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/g))
      levels.push({ level: Number(h[1]), label: h[2].replace(/<[^>]+>/g, '').trim() });
  }
  const out: string[] = [];
  let prev = 0;
  for (const { level, label } of levels) {
    if (prev && level > prev + 1) out.push(`“${label}” jumps from h${prev} to h${level}`);
    prev = level;
  }
  return out;
}

/** Splits `path#anchor`, `path?query` and returns just what a file system needs. */
export function splitTarget(target: string): { path: string; anchor: string } {
  const [beforeHash, anchor = ''] = target.split('#');
  return { path: decodeURI(beforeHash.split('?')[0]), anchor: decodeURIComponent(anchor) };
}

export const isExternal = (target: string) => /^(https?:)?\/\//.test(target);
export const isSkipped = (target: string) => /^(mailto:|tel:|data:|javascript:)/.test(target);
