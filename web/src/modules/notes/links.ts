import { displayTitle, isScratch } from './logic';
import type { Note } from './schema';

/** `[[Page title]]`; no `|` and no line breaks inside (the editor writes exactly this form). */
const WIKILINK = /\[\[([^\]\n|]+?)\]\]/g;

const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Link targets in a Markdown text, in order, without duplicates (compared ignoring case and accents). */
export function extractLinks(markdown: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of markdown.matchAll(WIKILINK)) {
    const target = m[1]!.trim();
    const key = fold(target);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(target);
    }
  }
  return out;
}

type Page = Pick<Note, 'title' | 'body'> & { id: string };

/** The page a link points to: same title, ignoring case and accents. A stored title wins over a first line. */
export function findPage<T extends Page>(target: string, pages: readonly T[]): T | undefined {
  const key = fold(target);
  if (!key) return undefined;
  const real = pages.filter((p) => !isScratch(p));
  return real.find((p) => fold(p.title) === key) ?? real.find((p) => fold(displayTitle(p)) === key);
}

/** Pages that link to `page`, most useful first (title order). The page itself is left out. */
export function backlinks<T extends Page>(page: Page, pages: readonly T[]): T[] {
  const titles = new Set([fold(page.title), fold(displayTitle(page))].filter(Boolean));
  if (titles.size === 0) return [];
  return pages
    .filter((p) => p.id !== page.id)
    .filter((p) => extractLinks(p.body).some((l) => titles.has(fold(l))))
    .sort((a, b) => displayTitle(a).localeCompare(displayTitle(b)));
}

/** Titles offered when typing `[[`: matching pages first, the scratch pad never. */
export function suggestTitles(query: string, pages: readonly Page[], max = 8): string[] {
  const q = fold(query);
  return pages
    .filter((p) => !isScratch(p))
    .map((p) => displayTitle(p).trim())
    .filter((title, i, all) => title && all.indexOf(title) === i)
    .filter((title) => !q || fold(title).includes(q))
    .sort(
      (a, b) => Number(fold(b).startsWith(q)) - Number(fold(a).startsWith(q)) || a.localeCompare(b),
    )
    .slice(0, max);
}
