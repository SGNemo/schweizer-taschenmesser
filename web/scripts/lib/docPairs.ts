/**
 * Keeps an English doc and its German translation (`README.md` ↔ `README.de.md`, `x.md` ↔ `x.de.md`) in step:
 * same heading outline, same number of `<details>` blocks, same external links, same local images and
 * the same relative link targets (a German file may point at the `.de.md` twin of a target).
 * Pure functions; `scripts/check-readme.mjs` reads the files.
 */

export interface DocShape {
  /** Heading levels in order (Markdown `#` and HTML `<h1>`–`<h6>`), code blocks ignored. */
  headings: number[];
  details: number;
  /** External link targets (href / Markdown links, not image sources), sorted and unique. */
  external: string[];
  /** Local image sources, `.de.png`-style German variants folded to the English name, sorted and unique. */
  images: string[];
  /** Relative link targets without anchor, `.de.md` folded to `.md`, sorted and unique. */
  relative: string[];
}

const stripCode = (text: string) => text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
const uniq = (xs: string[]) => [...new Set(xs)].sort();
const isExternal = (u: string) => /^(https?:|mailto:)/.test(u);

/** `docs/user/sync.de.md` → `docs/user/sync.md`, `README.de.md` → `README.md`. */
export function englishTwin(path: string): string {
  return path.replace(/\.de\.md$/, '.md');
}

export function docShape(text: string): DocShape {
  const body = stripCode(text);
  const headings: number[] = [];
  for (const line of body.split('\n')) {
    const md = /^(#{1,6})\s/.exec(line);
    if (md) headings.push(md[1].length);
    for (const m of line.matchAll(/<h([1-6])[\s>]/g)) headings.push(Number(m[1]));
  }
  const details = (body.match(/<details>/g) ?? []).length;

  const links: string[] = [];
  for (const m of body.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) links.push(m[1]);
  for (const m of body.matchAll(/<a\s[^>]*href="([^"]+)"/g)) links.push(m[1]);
  for (const m of body.matchAll(/^\[[^\]]+\]:\s*(\S+)/gm)) links.push(m[1]);

  const images: string[] = [];
  for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)) images.push(m[1]);
  for (const m of body.matchAll(/<(?:img|source)\s[^>]*(?:src|srcset)="([^"]+)"/g))
    images.push(m[1]);

  return {
    headings,
    details,
    external: uniq(links.filter(isExternal)),
    images: uniq(images.filter((s) => !isExternal(s)).map((s) => s.replace(/\.de\.(\w+)$/, '.$1'))),
    relative: uniq(
      links
        .filter((l) => !isExternal(l) && !l.startsWith('#'))
        .map((l) => englishTwin(l.split('#')[0]))
        .filter(Boolean),
    ),
  };
}

/** Differences between an English doc and its German twin, as readable lines (empty = in step). */
export function compareDocs(en: string, de: string): string[] {
  const a = docShape(en);
  const b = docShape(de);
  const out: string[] = [];
  if (a.headings.join() !== b.headings.join())
    out.push(`headings differ: en [${a.headings.join(' ')}] vs de [${b.headings.join(' ')}]`);
  if (a.details !== b.details)
    out.push(`<details> blocks differ: en ${a.details} vs de ${b.details}`);
  for (const key of ['external', 'images', 'relative'] as const) {
    const onlyEn = a[key].filter((x) => !b[key].includes(x));
    const onlyDe = b[key].filter((x) => !a[key].includes(x));
    if (onlyEn.length) out.push(`${key} links only in English: ${onlyEn.join(', ')}`);
    if (onlyDe.length) out.push(`${key} links only in German: ${onlyDe.join(', ')}`);
  }
  return out;
}
